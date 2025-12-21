/**
 * Stub APIs
 *
 * Not yet implemented APIs.
 */

class SDKError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'SDKError';
  }
}

const throwNotSupported = (feature: string): never => {
  throw new SDKError('NOT_SUPPORTED', `${feature} is not supported in this environment.`);
};

const stubAsync = <T = never>(feature: string) => async (): Promise<T> => throwNotSupported(feature);
const stubHandler = <T = never>(feature: string) => (): T => throwNotSupported(feature);

export const aiAPI = {
  chat: stubAsync('ai.chat'),
  summarize: stubAsync('ai.summarize'),
  translate: stubAsync('ai.translate'),
};

export const clipboardAPI = {
  readText: stubAsync('clipboard.readText'),
  writeText: stubAsync('clipboard.writeText'),
  readImage: stubAsync('clipboard.readImage'),
  writeImage: stubAsync('clipboard.writeImage'),
  onChange: stubHandler('clipboard.onChange'),
};

export const dialogAPI = {
  openFile: stubAsync('dialog.openFile'),
  openDirectory: stubAsync('dialog.openDirectory'),
  saveFile: stubAsync('dialog.saveFile'),
  message: stubAsync('dialog.message'),
};

export const fileAPI = {
  readText: stubAsync('file.readText'),
  readBinary: stubAsync('file.readBinary'),
  write: stubAsync('file.write'),
  append: stubAsync('file.append'),
  exists: stubAsync('file.exists'),
  stat: stubAsync('file.stat'),
  copy: stubAsync('file.copy'),
  move: stubAsync('file.move'),
  remove: stubAsync('file.remove'),
  list: stubAsync('file.list'),
  mkdir: stubAsync('file.mkdir'),
  persistPermission: stubAsync('file.persistPermission'),
};

export const onNotificationAction = stubHandler('onNotificationAction');
export const onFileDrop = stubHandler('onFileDrop');
