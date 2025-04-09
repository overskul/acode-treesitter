import { Parser } from 'web-tree-sitter';
import Manager from './manager.js';
import EventEmitter from 'eventemitter3';

const fs = acode.require('fs');
const Url = acode.require('url');

class TreeSitterAPI extends EventEmitter {
  #parser = {};
  #initialized = false;
  #initPromise = null;
  #languages = new Map();
  #config = {};

  constructor() {
    super();
    this.#initPromise = this.#initialize();
  }

  /**
   * Initialize TreeSitter parser
   * @private
   */
  async #initialize() {
    if (this.isInitialized) return;

    try {
      await Parser.init({
        locateFile: () => `https://localhost/__cdvfile_files-external__/plugins/x.treesitter/tree-sitter.wasm`
      });
      this.#config = await this.#loadConfig();
      this.#initialized = true;
      this.emit('initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize TreeSitter:', error);
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Get the base path for TreeSitter
   * @returns {string} Path to TreeSitter storage directory
   */
  get TREE_SITTER_PATH() {
    return acode.joinUrl(DATA_STORAGE, 'tree-sitter');
  }

  /**
   * Get the path to the TreeSitter configuration file
   * @returns {string} Path to configuration file
   */
  get CONFIG_PATH() {
    return acode.joinUrl(this.TREE_SITTER_PATH, 'config.json');
  }

  /**
   * Get the TreeSitter parser instance
   * @returns {Parser|null} TreeSitter parser
   */
  get parser() {
    return this.#parser;
  }

  /**
   * Check if TreeSitter is initialized
   * @returns {boolean} true if initialized
   */
  get isInitialized() {
    return this.#initialized;
  }

  /**
   * Get current configuration
   * @returns {Object} Configuration object
   */
  get config() {
    return this.#config;
  }

  /**
   * Wait for TreeSitter to initialize
   * @returns {Promise<boolean>} Resolves when initialization is complete
   */
  async waitForInit() {
    return this.#initPromise;
  }

  /**
   * Load configuration from storage
   * @returns {Promise<Object>} Loaded configuration
   * @private
   */
  async #loadConfig() {
    try {
      if (await fs(this.CONFIG_PATH).exists()) {
        this.#config = await fs(this.CONFIG_PATH).readFile('json');
      }
      return this.#config;
    } catch (error) {
      console.error('Failed to load config:', error);
      return {};
    }
  }

  /**
   * Save configuration to storage
   * @returns {Promise<boolean>} Success status
   * @private
   */
  async #saveConfig() {
    try {
      await fs(this.TREE_SITTER_PATH).createFile(
        'config.json',
        JSON.stringify(this.#config, null, 2)
      );
      return true;
    } catch (error) {
      console.error('Failed to save config:', error);
      return false;
    }
  }

  /**
   * Get a TreeSitter language by identifier
   * @param {string} lang - Language identifier
   * @param {Object} options - Optional parameters
   * @param {boolean} options.forceReload - Force reload language even if cached
   * @returns {Promise<Language>} Language instance
   */
  async getLanguage(lang, options = {}) {
    await this.waitForInit();

    if (!lang) throw new Error('Language identifier is required');

    // Return cached language unless force reload is requested
    if (!options.forceReload && this.#languages.has(lang)) {
      return this.#languages.get(lang);
    }

    try {
      const language = await Manager.getLanguage(lang);
      if (!language) {
        return null;
      }

      // Cache the language
      this.#languages.set(lang, language);
      return language;
    } catch (error) {
      console.error(`Error getting language ${lang}:`, error);
      this.emit('error', error);
      return null;
    }
  }

  /**
   * Create a new TreeSitter parser for a specific language
   * @param {string} lang - Language identifier
   * @returns {Promise<Parser>} Configured parser instance
   */
  async createParser(lang) {
    await this.waitForInit();

    const language = await this.getLanguage(lang);
    if (!language || !language.grammar) {
      throw new Error(`Cannot create parser: Language ${lang} not available or grammar not loaded`);
    }

    const parser = new Parser();
    await parser.setLanguage(language.grammar);

    return parser;
  }

  /**
   * Parse code with the specified language
   * @param {string} code - Code to parse
   * @param {string} lang - Language identifier
   * @param {Object} options - Optional parameters
   * @param {boolean} options.forceReload - Force reload parser even if cached
   * @returns {Promise<Object>} Syntax tree
   */
  async parse(lang, code, { forceReload = false }) {
    await this.waitForInit();

    try {
      if (!forceReload && this.#parser[lang]) return this.#parser[lang].parse(code);

      const parser = await this.createParser(lang);
      this.#parser[lang] = parser;
      return parser.parse(code);
    } catch (error) {
      console.error(`Parse error with language ${lang}:`, error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get list of available languages
   * @returns {Promise<string[]>} Array of language identifiers
   */
  async getAvailableLanguages() {
    return await Manager.getAvailableLanguages();
  }

  /**
   * Check if a language is available
   * @param {string} lang - Language identifier
   * @returns {Promise<boolean>} True if language is available
   */
  async isLanguageAvailable(lang) {
    return await Manager.isLanguageAvailable(lang);
  }

  /**
   * Install a language
   * @param {string} lang - Language identifier
   * @returns {Promise<boolean>} Installed language
   */
  async installLanguage(lang) {
    try {
      const success = await Manager.installLanguage(lang);
      if (success) {
        this.emit('language-installed', lang);
      }

      return true;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Uninstall a language
   * @param {string} lang - Language identifier
   * @returns {Promise<boolean>} Success status
   */
  async uninstallLanguage(lang) {
    try {
      // Remove from cache
      this.#languages.delete(lang);

      // Delegate to manager for file removal
      const success = await Manager.uninstallLanguage(lang);
      if (success) {
        this.emit('language-uninstalled', lang);
      }

      return success;
    } catch (error) {
      console.error(`Failed to uninstall ${lang}:`, error);
      this.emit('error', error);
      return false;
    }
  }
}

export default new TreeSitterAPI();
