import Api from './api.js';
import Language from './language.js';
import { minimatch } from 'minimatch';

const fs = acode.require('fs');
const Url = acode.require('url');

export default {
  CDN_URL: 'https://unpkg.com/',

  /**
   * Get a language definition, install it if not exist
   * @param {string} lang - Language identifier
   * @returns {Promise<Language>} Language instance
   */
  async getLanguage(lang) {
    const langPath = Url.join(Api.TREE_SITTER_PATH, lang);
    if (!(await fs(langPath).exists())) return;

    try {
      /**
       * Recursively traverses a directory and builds an object representation of its contents
       * @param {string} dirname - Directory name
       * @param {string} dirPath - Full path to directory
       * @returns {Object} - Object representation of directory contents
       */
      const _walk = async dirPath => {
        try {
          const files = await fs(dirPath).lsDir();
          const dir = {};

          await Promise.all(
            files.map(async file => {
              try {
                if (file.isDirectory) {
                  const subDir = await _walk(file.url);
                  dir[file.name] = subDir;
                } else {
                  const content = (await fs(file.url).readFile(this._getFileType(file.url))) || '';
                  dir[file.name] = content;
                }
              } catch (fileErr) {
                console.warn(
                  `Skipping ${file.isDirectory ? 'directory' : 'file'} ${file.name}: ${
                    fileErr.message
                  }`
                );
                dir[file.name] = null;
              }
            })
          );

          return dir;
        } catch (walkErr) {
          console.error(`Error walking directory ${dirname}:`, walkErr);
          return { [dirname]: {} };
        }
      };

      const root = await _walk(langPath);
      console.log(root)
      return new Language(
        lang,
        JSON.parse(root['tree-sitter.json'] ?? '{}'),
        Object.entries(root)
          .filter(([filename]) => filename.endsWith('.wasm'))
          .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {}),
        root.queries,
        false
      );
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
      console.log(metaUrl);
      const fetch = await this._fetch(metaUrl);
      if (fetch.status !== 200) throw new Error('failed while fetch metadata, code:', fetch.status);
      const globalMeta = JSON.parse(fetch?.data);
      console.log(globalMeta);
      if (!globalMeta || !globalMeta.files)
        throw new Error(`Failed to get global metadata from ${baseUrl}`);

      for (const item of items) {
        let { pattern, dest } = item;
        const isDirectory = pattern.endsWith('/');

        if (isDirectory) {
          await fs(dest).createDirectory(pattern.slice(0, -1));
          dest = Url.join(dest, pattern);
          console.log(dest);
        }

        const matchingFiles = globalMeta.files.filter(file => {
          const path = file.path.slice(globalMeta.prefix.length);
          console.log(path);
          if (isDirectory) return path.startsWith(pattern);
          return minimatch(path, pattern);
        });

        console.log(matchingFiles);

        const baseUrl = this.buildUrl(lang, '', globalMeta.version);
        for (const file of matchingFiles) {
          const fileUrl = Url.join(baseUrl, file.path);
          console.log(fileUrl);
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
