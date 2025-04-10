# Acode TreeSitter Plugin

This plugin integrates the powerful Tree-sitter parsing system into Acode, enabling sophisticated code analysis, syntax highlighting, and programmatic manipulation of code structures. Tree-sitter creates concrete syntax trees for source code that can be used for more advanced code intelligence features.

## Features

- **Fast, Incremental Parsing**: Efficient parsing that only re-parses changed portions of code
- **Multi-Language Support**: Install and use Tree-sitter grammars for various programming languages
- **Programmatic API**: Easily interface with Tree-sitter from your own plugins or scripts
- **Language Management**: Simple API to install, load, and uninstall language grammars
- **Memory Efficient**: Only loads language grammars when needed

## Important Note

This plugin provides an API only and does not affect the Acode user interface directly. It is intended to be used by other plugins or scripts that need advanced code parsing capabilities.

## API Documentation

### TreeSitterAPI Class

The main API accessible via `acode.require('tree-sitter')`.

#### Properties

- **isInitialized**: `Boolean` - Indicates if Tree-sitter has been successfully initialized
- **parser**: `Object` - Access to the underlying parser instances
- **config**: `Object` - Current configuration object
- **TREE_SITTER_PATH**: `String` - Path to Tree-sitter storage directory
- **CONFIG_PATH**: `String` - Path to configuration file

#### Methods

##### `async waitForInit()`
Wait for Tree-sitter to initialize.
- Returns: `Promise<Boolean>` - Resolves when initialization is complete

##### `async getLanguage(lang, options = {})`
Get a Tree-sitter language by identifier.
- Parameters:
  - `lang`: `String` - Language identifier
  - `options`: `Object` - Optional parameters
    - `forceReload`: `Boolean` - Force reload language even if cached
- Returns: `Promise<Language>` - Language instance

##### `async createParser(lang, options = {})`
Create a new Tree-sitter parser for a specific language.
- Parameters:
  - `lang`: `String` - Language identifier
  - `options`: `Object` - Optional parameters
    - `autoLoadGrammar`: `Boolean` - Automatically load grammar if not loaded
- Returns: `Promise<Parser>` - Configured parser instance

##### `async parse(lang, code, options = {})`
Parse code with the specified language.
- Parameters:
  - `lang`: `String` - Language identifier
  - `code`: `String` - Code to parse
  - `options`: `Object` - Optional parameters
    - `forceReload`: `Boolean` - Force reload parser even if cached
- Returns: `Promise<Object>` - Syntax tree

##### `async getAvailableLanguages()`
Get list of available languages.
- Returns: `Promise<String[]>` - Array of language identifiers

##### `async isLanguageAvailable(lang)`
Check if a language is available.
- Parameters:
  - `lang`: `String` - Language identifier
- Returns: `Promise<Boolean>` - True if language is available

##### `async installLanguage(lang)`
Install a language.
- Parameters:
  - `lang`: `String` - Language identifier
- Returns: `Promise<Boolean>` - Installation success status

##### `async uninstallLanguage(lang)`
Uninstall a language.
- Parameters:
  - `lang`: `String` - Language identifier
- Returns: `Promise<Boolean>` - Success status

##### `clear()`
Clear languages and parsers.

#### Events

The API extends EventEmitter and emits the following events:

- **initialized**: Emitted when Tree-sitter is fully initialized
- **error**: Emitted when an error occurs, with error object as parameter
- **language-installed**: Emitted when a language is installed, with language ID as parameter
- **language-uninstalled**: Emitted when a language is uninstalled, with language ID as parameter

### Language Class

Accessible via `acode.require('@tree-sitter/language')`.

#### Properties

- **name**: `String` - Language identifier
- **config**: `Object` - Language configuration
- **wasmUrl**: `String|Object` - WASM URL or URLs
- **extensions**: `Object` - Language extensions
- **isExtension**: `Boolean` - Whether this language is an extension
- **grammar**: `Object` - The compiled grammar (null if not loaded)
- **queries**: `Object` - Queries for the language
- **isLoaded**: `Boolean` - Whether the grammar has been loaded

#### Methods

##### `getQuery(queryName)`
Get a specific query by name.
- Parameters:
  - `queryName`: `String` - Name of the query (e.g., 'highlights', 'locals')
- Returns: `String|null` - Query content or null if not found

##### `async loadGrammar()`
Load the grammar from WASM.
- Returns: `Promise<Object>` - Loaded grammar

##### `unloadGrammar()`
Unload grammar to free memory.
- Returns: `Boolean` - Success status

## Usage Examples

### Basic Parser Usage

```javascript
// Get the Tree-sitter API
const treeSitter = acode.require('tree-sitter');

// Use Tree-sitter to parse JavaScript code
async function parseCode() {
  // Make sure JavaScript language is installed
  if (!(await treeSitter.isLanguageAvailable('javascript'))) {
    await treeSitter.installLanguage('javascript');
  }
  
  // Parse some code
  const code = 'function add(a, b) { return a + b; }';
  const tree = await treeSitter.parse('javascript', code);
  
  // Work with the syntax tree
  console.log(tree.rootNode.toString());
}
```

### Using Queries

```javascript
// Get the Tree-sitter API
const treeSitter = acode.require('tree-sitter');

// Use Tree-sitter to find all function declarations in JavaScript code
async function findFunctions() {
  const jsLang = await treeSitter.getLanguage('javascript');
  const parser = await treeSitter.createParser('javascript');
  
  const code = `
    function add(a, b) { return a + b; }
    const subtract = function(a, b) { return a - b; };
    const multiply = (a, b) => a * b;
  `;
  
  const tree = parser.parse(code);
  
  // Get the highlights query
  const query = jsLang.getQuery('highlights');
  if (query) {
    const matches = query.matches(tree.rootNode);
    console.log('Found function declarations:', matches);
  }
}
```

### Event Handling

```javascript
// Get the Tree-sitter API
const treeSitter = acode.require('tree-sitter');

// Listen for events
treeSitter.on('language-installed', (lang) => {
  console.log(`Language ${lang} was installed`);
});

treeSitter.on('error', (error) => {
  console.error('Tree-sitter error:', error);
});
```

## Installation

1. Open Acode
2. Go to Settings > Plugins
3. Search for "TreeSitter"
4. Install the plugin

## Credits

- [Tree-sitter](https://tree-sitter.github.io/tree-sitter/) - The incremental parsing system
- [web-tree-sitter](https://github.com/tree-sitter/tree-sitter/tree/master/lib/binding_web) - Web bindings for Tree-sitter