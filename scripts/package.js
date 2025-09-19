#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = packageJson.version || '1.0.0';
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

console.log('📦 开始打包源代码...');

// 创建输出目录
const outputDir = 'dist';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// 获取git信息
let gitHash = '';
let gitBranch = '';
try {
  gitHash = execSync('git rev-parse HEAD').toString().trim().substring(0, 7);
  gitBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
} catch (e) {
  console.log('⚠️ 无法获取git信息');
}

const releaseInfo = {
  version,
  timestamp,
  gitHash,
  gitBranch,
  buildTime: new Date().toLocaleString('zh-CN')
};

// 写入构建信息
fs.writeFileSync(
  path.join(outputDir, 'build-info.json'),
  JSON.stringify(releaseInfo, null, 2)
);

console.log('📝 构建信息:', releaseInfo);

// 创建排除文件列表
const excludePatterns = [
  'node_modules',
  '.next',
  'dist',
  '.git',
  '.vercel',
  '*.log',
  '.env*',
  '.claude',
  'image.png'
];

const excludeArgs = excludePatterns.map(pattern => `--exclude='${pattern}'`).join(' ');

// 创建tar.gz
const tarName = `source-code-v${version}-${timestamp}.tar.gz`;
const tarPath = path.join(outputDir, tarName);

try {
  execSync(`tar -czf "${tarPath}" ${excludeArgs} .`, { stdio: 'inherit' });
  console.log(`✅ 创建tar.gz: ${tarPath}`);
} catch (e) {
  console.log('❌ tar.gz创建失败:', e.message);
}

// 创建zip (Windows兼容)
const zipName = `source-code-v${version}-${timestamp}.zip`;
const zipPath = path.join(outputDir, zipName);

try {
  // 使用PowerShell创建zip (Windows)
  if (process.platform === 'win32') {
    const tempDir = 'temp-zip';

    // 创建临时目录
    if (fs.existsSync(tempDir)) {
      execSync(`rmdir /s /q "${tempDir}"`, { stdio: 'inherit' });
    }
    fs.mkdirSync(tempDir);

    // 复制文件（排除指定目录）
    const copyCommand = `robocopy . "${tempDir}" /E /XD ${excludePatterns.filter(p => !p.includes('*')).join(' ')} /XF *.log .env* image.png /NFL /NDL /NJH /NJS`;
    try {
      execSync(copyCommand, { stdio: 'inherit' });
    } catch (e) {
      // robocopy 返回码不为0不一定是错误
    }

    // 创建zip
    const powershellCmd = `Compress-Archive -Path "${tempDir}\\*" -DestinationPath "${zipPath}" -Force`;
    execSync(`powershell -Command "${powershellCmd}"`, { stdio: 'inherit' });

    // 清理临时目录
    execSync(`rmdir /s /q "${tempDir}"`, { stdio: 'inherit' });

    console.log(`✅ 创建zip: ${zipPath}`);
  } else {
    // Linux/Mac使用zip命令
    execSync(`zip -r "${zipPath}" . ${excludeArgs.replace(/--exclude=/g, '-x ')}`, { stdio: 'inherit' });
    console.log(`✅ 创建zip: ${zipPath}`);
  }
} catch (e) {
  console.log('❌ zip创建失败:', e.message);
}

console.log('\n🎉 打包完成！');
console.log(`📁 输出目录: ${path.resolve(outputDir)}`);

// 显示文件大小
try {
  if (fs.existsSync(tarPath)) {
    const tarSize = (fs.statSync(tarPath).size / 1024 / 1024).toFixed(2);
    console.log(`📦 ${tarName}: ${tarSize}MB`);
  }
  if (fs.existsSync(zipPath)) {
    const zipSize = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(2);
    console.log(`📦 ${zipName}: ${zipSize}MB`);
  }
} catch (e) {
  console.log('⚠️ 无法获取文件大小');
}