"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMultipleFilesPath = exports.getSingleFilePath = void 0;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getSingleFilePath = (files, folderName) => {
    const fileField = files === null || files === void 0 ? void 0 : files[folderName];
    if (fileField && Array.isArray(fileField) && fileField.length > 0) {
        return `/${folderName}/${fileField[0].filename}`;
    }
    return undefined;
};
exports.getSingleFilePath = getSingleFilePath;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getMultipleFilesPath = (files, folderName) => {
    const folderFiles = files === null || files === void 0 ? void 0 : files[folderName];
    if (folderFiles && Array.isArray(folderFiles)) {
        return folderFiles.map((file) => `/${folderName}/${file.filename}`);
    }
    return undefined;
};
exports.getMultipleFilesPath = getMultipleFilesPath;
