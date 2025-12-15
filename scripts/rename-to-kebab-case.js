#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function toKebabCase(str) {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

function needsRename(filename) {
  const nameWithoutExt = path.parse(filename).name;
  return nameWithoutExt !== toKebabCase(nameWithoutExt);
}

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (/\.(ts|tsx|css|json)$/.test(file)) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

function normalizePath(p) {
  return p.replace(/\\/g, '/');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function updateImports(filePath, renameMap, frontendSrc) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  const fileDir = path.dirname(filePath);
  
  renameMap.forEach(({ oldFullPath, newFullPath }) => {
    const oldRelPath = normalizePath(path.relative(frontendSrc, oldFullPath));
    const newRelPath = normalizePath(path.relative(frontendSrc, newFullPath));
    
    const oldPathWithoutExt = oldRelPath.replace(/\.[^.]+$/, '');
    const newPathWithoutExt = newRelPath.replace(/\.[^.]+$/, '');
    
    const relativeOldPath = normalizePath(path.relative(fileDir, oldFullPath));
    const relativeNewPath = normalizePath(path.relative(fileDir, newFullPath));
    
    const relativeOldPathWithoutExt = relativeOldPath.replace(/\.[^.]+$/, '');
    const relativeNewPathWithoutExt = relativeNewPath.replace(/\.[^.]+$/, '');
    
    const patterns = [
      {
        regex: new RegExp(`(['"])@/${escapeRegex(oldRelPath.replace(/\.[^.]+$/, ''))}(['"])`, 'g'),
        replacement: `$1@/${newPathWithoutExt}$2`,
      },
      {
        regex: new RegExp(`(['"])@/${escapeRegex(oldRelPath)}(['"])`, 'g'),
        replacement: `$1@/${newRelPath}$2`,
      },
      {
        regex: new RegExp(`(['"])${escapeRegex(relativeOldPathWithoutExt)}(['"])`, 'g'),
        replacement: `$1${relativeNewPathWithoutExt}$2`,
      },
      {
        regex: new RegExp(`(['"])${escapeRegex(relativeOldPath)}(['"])`, 'g'),
        replacement: `$1${relativeNewPath}$2`,
      },
    ];
    
    patterns.forEach(({ regex, replacement }) => {
      const newContent = content.replace(regex, replacement);
      if (newContent !== content) {
        content = newContent;
        changed = true;
      }
    });
  });
  
  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
  
  return changed;
}

function main() {
  const frontendSrc = path.join(__dirname, '..', 'frontend', 'src');
  const allFiles = getAllFiles(frontendSrc);
  
  const renameMap = [];
  
  allFiles.forEach(filePath => {
    const dir = path.dirname(filePath);
    const filename = path.basename(filePath);
    const ext = path.extname(filePath);
    const nameWithoutExt = path.parse(filename).name;
    
    if (needsRename(filename)) {
      const newName = toKebabCase(nameWithoutExt) + ext;
      const oldPath = filePath;
      const newPath = path.join(dir, newName);
      
      renameMap.push({
        oldFullPath: oldPath,
        newFullPath: newPath,
      });
    }
  });
  
  console.log(`找到 ${renameMap.length} 个需要重命名的文件`);
  
  if (renameMap.length === 0) {
    console.log('没有文件需要重命名');
    return;
  }
  
  renameMap.forEach(({ oldFullPath, newFullPath }) => {
    const oldRel = normalizePath(path.relative(frontendSrc, oldFullPath));
    const newRel = normalizePath(path.relative(frontendSrc, newFullPath));
    console.log(`重命名: ${oldRel} -> ${newRel}`);
  });
  
  console.log('\n开始重命名文件...');
  
  renameMap.forEach(({ oldFullPath, newFullPath }) => {
    if (fs.existsSync(oldFullPath)) {
      fs.renameSync(oldFullPath, newFullPath);
    }
  });
  
  console.log('文件重命名完成，开始更新 import 引用...');
  
  const allFilesAfterRename = getAllFiles(frontendSrc);
  let updatedCount = 0;
  
  allFilesAfterRename.forEach(filePath => {
    if (updateImports(filePath, renameMap, frontendSrc)) {
      updatedCount++;
    }
  });
  
  console.log(`更新了 ${updatedCount} 个文件的 import 引用`);
  console.log('重命名完成！');
}

main();
