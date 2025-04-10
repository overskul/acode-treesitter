import Api from './api.js';
import Language from './language.js';
import { minimatch } from 'minimatch';

const fs = acode.require('fs');
const Url = acode.require('url');

export default {
  CDN_URL: 'https://unpkg.com/',

  /**
   * Get a language
   * @param {string} lang - Language identifier
   * @returns {Promise<Language|null>} Language instance or null if not found
   */
  async getLanguage(lang) {
    const langPath = Url.join(Api.TREE_SITTER_PATH, lang);
    if (!(await fs(langPath).exists())) return;

    try {
      const files = await fs(langPath).lsDir();

      const configFile = files.find(file => file.name === 'tree-sitter.json');
      if (!configFile) throw new Error(`Missing tree-sitter.json for language ${lang}`);

      const config = await fs(configFile.url).readFile('json');
      const wasmFiles = files
        .filter(file => file.name.endsWith('.wasm'))
        .reduce(
          (obj, file) => ({
            ...obj,
            [file.name]: file.url
          }),
          {}
        );

      const queriesDir = files.find(file => file.name === 'queries' && file.isDirectory);
      let queries = {};

      if (queriesDir) {
        const queryFiles = await fs(queriesDir.url).lsDir();
        await Promise.all(
          queryFiles.map(async file => {
            if (!file.isDirectory && file.name.endsWith('.scm')) {
              const content = await fs(file.url).readFile('utf-8');
              queries[file.name] = content;
            }
          })
        );
      }

      return new Language(lang, config, wasmFiles, queries, false);
    } catch (error) {
      console.error(`Error loading language ${lang}:`, error);
      throw new Error(`Failed to load language ${lang}: ${error.message}`);
    }
  },

  /**
   * install a language
   * @param {string} lang - Language identifier
   * @returns {Promise<boolean>}
   */
  async installLanguage(lang) {
    const langPath = Url.join(Api.TREE_SITTER_PATH, lang);
    if (await fs(langPath).exists()) return false;

    try {
      await fs(Api.TREE_SITTER_PATH).createDirectory(lang);

      const filesToDownload = [
        { pattern: 'tree-sitter.json', dest: langPath },
        { pattern: '*.wasm', dest: langPath },
        { pattern: 'queries/', dest: langPath }
      ];

      const success = await this._download(lang, filesToDownload);
      return success;
    } catch (error) {
      console.error(`Error installing language ${lang}:`, error.message);
      // Clean up any partial downloads
      if (await fs(langPath).exists()) {
        await fs(langPath).delete();
      }
      throw error;
    }
  },

  /**
   * uninstall a language
   * @param {string} lang - Language identifier
   * @returns {Promise<boolean>}
   */
  async uninstallLanguage(lang) {
    const langPath = Url.join(Api.TREE_SITTER_PATH, lang);

    // Check if language exists
    if (!(await fs(langPath).exists())) return false;

    try {
      await fs(langPath).delete();
      return true;
    } catch (e) {
      console.error(`Error uninstalling language ${lang}:`, error.message);
      throw error;
    }
  },

  /**
   * Download files and directories using global metadata and path matching
   * @param {string} baseUrl - Base URL for the package (e.g., 'https://unpkg.com/package@version/')
   * @param {Array<Object>} items - Array of items to download, each with pattern and dest
   * @returns {Promise<boolean>} Paths to downloaded files/directories
   * @private
   */
  async _download(lang, items) {
    try {
      const metaUrl = `${this.buildUrl(lang)}?meta`;
      const response = await this._fetch(metaUrl);
      if (response.status !== 200)
        throw new Error('failed while fetch metadata, code:', response.status);

      const globalMeta = JSON.parse(response?.data);
      if (!globalMeta || !globalMeta.files)
        throw new Error(`Failed to get global metadata from ${baseUrl}`);

      for (const item of items) {
        let { pattern, dest } = item;
        const isDirectory = pattern.endsWith('/');

        if (isDirectory) {
          await fs(dest).createDirectory(pattern.slice(0, -1));
          dest = Url.join(dest, pattern);
        }

        const matchingFiles = globalMeta.files.filter(file => {
          const path = file.path.slice(globalMeta.prefix.length);
          if (isDirectory) return path.startsWith(pattern);
          return minimatch(path, pattern);
        });

        const baseUrl = this.buildUrl(lang, '', globalMeta.version);
        for (const file of matchingFiles) {
          const fileUrl = Url.join(baseUrl, file.path);
          await this._downloadFile(fileUrl, dest);
        }
      }

      return true;
    } catch (error) {
      console.error(`Error downloading:`, error);
      throw error;
    }
  },

  /**
   * Download a file from CDN
   * @param {string} url - URL to download
   * @param {string} folder - Destination folder
   * @returns {Promise<string>} Path to downloaded file
   * @private
   */
  async _downloadFile(url, folder) {
    const filename = Url.basename(url);

    try {
      const ext = Url.extname(filename);
      const type = this._getFileType(ext);
      const content = await Promise.race([
        fs(url).readFile(type),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Download timeout')), 30000))
      ]);

      if (content === null) throw new Error(`Empty content from ${url}`);

      const filePath = Url.join(folder, filename);
      await fs(folder).createFile(filename, content);
      return filePath;
    } catch (error) {
      console.error(`Failed to download ${url}:`, error);
      throw error;
    }
  },

  /**
   * Get file type based on extension for proper reading
   * @param {string} ext - File extension
   * @returns {string|null} File type or null for binary
   * @private
   */
  _getFileType(ext) {
    switch (ext) {
      case '.json':
        return 'json';
      case '.wasm':
        return null; // Binary
      default:
        return 'utf-8';
    }
  },

  /**
   * Build URL for a language resource
   * @param {string} lang - Language identifier
   * @param {string} path - Path to resource
   * @param {string} version - Version of language
   * @returns {string} Full URL
   */
  buildUrl(lang, path = '', version = 'latest') {
    return Url.join(this.CDN_URL, `tree-sitter-${lang}@${version}`, path);
  },

  /**
   * Check if a language is available locally
   * @param {string} lang - Language identifier
   * @returns {Promise<boolean>} True if language is available
   */
  async isLanguageAvailable(lang) {
    const langPath = Url.join(Api.TREE_SITTER_PATH, lang);
    return await fs(langPath).exists();
  },

  /**
   * Get list of locally available languages
   * @returns {Promise<string[]>} Array of available language IDs
   */
  async getAvailableLanguages() {
    try {
      const dirs = await fs(Api.TREE_SITTER_PATH).lsDir();
      return dirs.filter(dir => dir.isDirectory).map(dir => dir.name);
    } catch (error) {
      console.error('Failed to get available languages:', error);
      return [];
    }
  },

  /**
   * fetch using http plugin because of cross issues
   * @returns {Promise<Object>} fetch result
   * @private
   */
  async _fetch(url) {
    return new Promise((res, rej) => cordova.plugin.http.get(url, null, null, res, rej));
  }
};
