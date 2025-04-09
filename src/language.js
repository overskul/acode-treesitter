import { Parser } from 'web-tree-sitter';

const log = (...v) => console.log(...v);

export default class Language {
  #name;
  #config;
  #wasm;
  #queries;
  #grammar;
  #extensions;

  /**
   * Create a new Language instance
   * @param {string} name - Language identifier
   * @param {Object} config - Language configuration
   * @param {Object|ArrayBuffer} wasm - WASM binary content
   * @param {Object} queries - Query files for syntax highlighting
   * @param {Boolean} isExtension - is Wasm Extension
   */
  constructor(name, config, wasm, queries, isExtension = false) {
    this.#name = name;
    this.#config = config;
    this.#wasm = wasm;
    this.#queries = queries;
    this.#grammar = null;
    this.#extensions = isExtension ? null : {}; // Explicitly set to null for extensions

    console.log(name, isExtension, this.#extensions);
    if (!isExtension) {
      log('init extensions');
      this.#initializeExtensions();
    }
  }

  /**
   * Create extension Language objects for each additional WASM file
   */
  #initializeExtensions() {
    const wasm = this.#wasm;
    const mainFile = Object.keys(this.#wasm).find(
      filename => this.#getNameFromFilename(filename) === this.#name
    );

    log("mainFile", mainFile);

    if (mainFile) {
      this.#wasm = _toArrayBuffer(this.#wasm[mainFile]);
    }

    // Now process extensions (after setting main WASM)
    for (const filename in wasm) {
      log("filename", filename)
      // Skip if this is the main file we already processed
      if (filename === mainFile) continue;

      const extName = this.#getNameFromFilename(filename);
      console.log(`Creating extension: ${extName} from ${filename}`);

      // Pass ONLY the binary for this extension
      const wasmBinary = _toArrayBuffer(wasm[filename]);

      this.#extensions[extName] = new Language(
        extName,
        this.#config,
        wasmBinary, // This should be just the single binary, not the whole object
        this.#queries,
        true
      );

      // Verify
      console.log(
        `Created extension ${extName}, isExtension=${this.#extensions[extName].isExtension}`
      );
    }

    // After processing all extensions, replace this.#wasm if it wasn't set yet
    // if (
    //   typeof this.#wasm === 'object' &&
    //   !ArrayBuffer.isView(this.#wasm) &&
    //   !(this.#wasm instanceof ArrayBuffer)
    // ) {
    //   console.warn(`No main WASM found for ${this.#name}, using first available`);
    //   const firstFile = Object.keys(this.#wasm)[0];
    //   this.#wasm = _toArrayBuffer(this.#wasm[firstFile]);
    // }
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
   * Get WASM binary
   */
  get wasm() {
    return this.#wasm;
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
    if (!this.#wasm) throw new Error(`No WASM file available for language '${this.#name}'`);

    try {
      const wasmBuffer = _toArrayBuffer(this.#wasm);
      this.#grammar = await Parser.Language.load(wasmBuffer);

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

function _toArrayBuffer(v) {
  return v instanceof ArrayBuffer ? v : new Uint8Array(v).buffer;
}
