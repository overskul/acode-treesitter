import plugin from '../plugin.json';
import Api from './api.js';
import Language from './language.js';

const confirm = acode.require('confirm');
const fs = acode.require('fs');
const Url = acode.require('url');

class AcodeTreeSitter {
  async init() {
    // init main folder
    if (!(await fs(Api.TREE_SITTER_PATH).exists())) {
      await fs(Url.dirname(Api.TREE_SITTER_PATH)).createDirectory(
        Url.basename(Api.TREE_SITTER_PATH)
      );
    }

    // init config file
    if (!(await fs(Api.CONFIG_PATH).exists())) {
      await fs(Url.dirname(Api.CONFIG_PATH)).createFile(Url.basename(Api.CONFIG_PATH), '{}');
    }

    acode.define('tree-sitter', Api);
    acode.define('@tree-sitter/language', Language);
  }

  async destroy() {
    const confirmation = await confirm(
      'Warning',
      `Do want to remove installed tree sitter packages (${
        (await Api.getAvailableLanguages()).length
      }) ?`
    );

    if (confirmation) {
      await fs(Api.TREE_SITTER_PATH).delete();
    }

    acode.define('tree-sitter', undefined);
    acode.define('@tree-sitter/language', undefined);
  }
}

if (window.acode) {
  const acodePlugin = new AcodeTreeSitter();
  acode.setPluginInit(plugin.id, async (baseUrl, $page, { cacheFileUrl, cacheFile }) => {
    if (!baseUrl.endsWith('/')) {
      baseUrl += '/';
    }
    acodePlugin.baseUrl = baseUrl;
    await acodePlugin.init($page, cacheFile, cacheFileUrl);
  });
  acode.setPluginUnmount(plugin.id, async () => {
    await acodePlugin.destroy();
  });
}
