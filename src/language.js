import Api from './api.js';
import { Language as TSLanguage } from 'web-tree-sitter';

export default class Language {
  #name;
  #config;
  #wasmUrls;
  #queries;
  #grammar;
  #extensions;

  /**
   * Create a new Language instance
   * @param {string} name - Language identifier
   * @param {Object} config - Language configuration
   * @param {Object|string} wasmUrls - WASM file URLs
   * @param {Object} queries - Query files for syntax highlighting
   * @param {Boolean} isExtension - is Wasm Extension
   */
  constructor(name, config, wasmUrls, queries, isExtension = false) {
    this.#name = name;
    this.#config = config;
    this.#wasmUrls = wasmUrls;
    this.#queries = queries;
    this.#grammar = null;
    this.#extensions = isExtension ? null : {};

    if (!isExtension) {
      this.#initializeExtensions();
    }
  }

  /**
   * Create extension Language objects for each additional WASM file
   */
  #initializeExtensions() {
    const wasmUrls = this.#wasmUrls;
    const mainFile = Object.keys(this.#wasmUrls).find(
      filename => this.#getNameFromFilename(filename) === this.#name
    );

    if (mainFile) {
      this.#wasmUrls = wasmUrls[mainFile];
    }

    for (const filename in wasmUrls) {
      if (filename === mainFile) continue;

      const extName = this.#getNameFromFilename(filename);
      const wasmUrl = wasmUrls[filename];

      const extension = new Language(extName, this.#config, wasmUrl, this.#queries, true);

      this.#extensions[extName] = extension;
    }
  }

  /**
   * Extract name from WASM filename
   * @param {string} filename - WASM filename
   */
  #getNameFromFilename(filename) {
    const nameWithoutExt = filename.replace(/\.wasm$/, '');
    if (nameWithoutExt.startsWith('tree-sitter-')) {
      return nameWithoutExt.substring('tree-sitter-'.length);
    }

    return nameWithoutExt;
  }

  /**
   * Get language identifier
   */
  get name() {
    return this.#name;
  }

  /**
   * Get language configuration
   */
  get config() {
    return this.#config;
  }

  /**
   * Get WASM URL
   */
  get wasmUrl() {
    return this.#wasmUrls;
  }

  /**
   * Get all extensions
   */
  get extensions() {
    return this.#extensions;
  }

  /**
   * Get if this language is extension
   */
  get isExtension() {
    return !this.#extensions;
  }

  /**
   * Get the compiled grammar
   */
  get grammar() {
    return this.#grammar;
  }

  /**
   * Get queries for the language
   */
  get queries() {
    return this.#queries;
  }

  /**
   * Check if grammar has been loaded
   */
  get isLoaded() {
    return this.#grammar !== null;
  }

  /**
   * Get a specific query by name
   * @param {string} queryName - Name of the query (e.g., 'highlights', 'locals')
   */
  getQuery(queryName) {
    const queryFile = `${queryName}.scm`;
    return this.#queries && this.#queries[queryFile] ? this.#queries[queryFile] : null;
  }

  /**
   * Load the grammar from WASM
   */
  async loadGrammar() {
    if (this.isLoaded) return this.#grammar;
    if (!this.#wasmUrls) throw new Error(`No WASM file available for language '${this.#name}'`);

    try {
      const wasmUrl = await acode.toInternalUrl(this.#wasmUrls);
      this.#grammar = await TSLanguage.load(wasmUrl);

      return this.#grammar;
    } catch (error) {
      console.error(`Failed to load grammar for language '${this.#name}':`, error);
      throw new Error(`Failed to load grammar for language '${this.#name}': ${error.message}`);
    }
  }

  /**
   * Unload grammar to free memory
   */
  unloadGrammar() {
    this.#grammar = null;
    return true;
  }
}
