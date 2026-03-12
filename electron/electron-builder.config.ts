// ============================================================================
// Naotu Electron — electron-builder 配置
// ============================================================================

const config = {
    appId: 'com.naotu.desktop',
    productName: 'Naotu',
    copyright: 'Copyright © 2026 Naotu',

    directories: {
        output: 'release',
        buildResources: 'build',
    },

    files: [
        'dist/**/*',
        'package.json',
    ],

    // ── 额外资源（打包进 app resources） ──
    extraResources: [
        {
            from: '../frontend/.next/standalone',
            to: 'frontend',
            filter: ['**/*'],
        },
        {
            from: '../backend/dist',
            to: 'backend',
            filter: ['**/*'],
        },
        {
            from: '../frontend/public/icons',
            to: 'icons',
            filter: ['**/*'],
        },
    ],

    // ── Windows ──
    win: {
        target: [
            { target: 'nsis', arch: ['x64'] },
            { target: 'portable', arch: ['x64'] },
        ],
        icon: 'build/icon.ico',
    },

    nsis: {
        oneClick: false,
        perMachine: false,
        allowToChangeInstallationDirectory: true,
        installerIcon: 'build/icon.ico',
        uninstallerIcon: 'build/icon.ico',
        installerHeaderIcon: 'build/icon.ico',
        createDesktopShortcut: true,
        createStartMenuShortcut: true,
        shortcutName: 'Naotu',
    },

    // ── macOS ──
    mac: {
        target: [
            { target: 'dmg', arch: ['x64', 'arm64'] },
        ],
        icon: 'build/icon.icns',
        category: 'public.app-category.productivity',
        hardenedRuntime: true,
        entitlements: 'build/entitlements.mac.plist',
        entitlementsInherit: 'build/entitlements.mac.plist',
    },

    dmg: {
        contents: [
            { x: 130, y: 220 },
            { x: 410, y: 220, type: 'link', path: '/Applications' },
        ],
    },

    // ── Linux ──
    linux: {
        target: [
            { target: 'AppImage', arch: ['x64'] },
            { target: 'deb', arch: ['x64'] },
        ],
        icon: 'build/icons',
        category: 'Office',
    },

    // ── 自动更新 ──
    publish: {
        provider: 'github',
        owner: 'naotu',
        repo: 'naotu',
        releaseType: 'release',
    },
};

export default config;
