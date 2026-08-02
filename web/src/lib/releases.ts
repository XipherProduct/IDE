export interface ReleaseAsset {
  platform: string;
  os: string;
  arch: string;
  filename: string;
  sizeBytes: number;
  sizeLabel: string;
}

export interface Release {
  version: string;
  tag: string;
  baseUrl: string;
  releasedAt: string;
  repoUrl: string;
  installScriptUnix: string;
  installScriptWin: string;
  goInstallCmd: string;
  checksumsUrl: string;
  assets: ReleaseAsset[];
}

export const LATEST: Release = {
  version: "0.4.0",
  tag: "v0.4.0",
  baseUrl:
    "https://github.com/xipher-pro/xipher-ide/releases/download/v0.4.0/",
  releasedAt: "2026-04-18T23:31:00Z",
  repoUrl: "https://github.com/xipher-pro/xipher-ide",
  installScriptUnix:
    "curl -fsSL https://raw.githubusercontent.com/xipher-pro/xipher-ide/main/install.sh | sh",
  installScriptWin:
    "iwr -useb https://raw.githubusercontent.com/xipher-pro/xipher-ide/main/install.ps1 | iex",
  goInstallCmd:
    "go install github.com/xipher-pro/xipher-ide/cmd/xipher@latest",
  checksumsUrl:
    "https://github.com/xipher-pro/xipher-ide/releases/download/v0.4.0/checksums.txt",
  assets: [
    {
      platform: "darwin-arm64",
      os: "macOS",
      arch: "Apple Silicon",
      filename: "xipher_0.4.0_macos_arm64.tar.gz",
      sizeBytes: 4654694,
      sizeLabel: "4.44 MB",
    },
    {
      platform: "darwin-amd64",
      os: "macOS",
      arch: "Intel",
      filename: "xipher_0.4.0_macos_x86_64.tar.gz",
      sizeBytes: 4948787,
      sizeLabel: "4.72 MB",
    },
    {
      platform: "linux-amd64",
      os: "Linux",
      arch: "x86_64",
      filename: "xipher_0.4.0_linux_x86_64.tar.gz",
      sizeBytes: 5011743,
      sizeLabel: "4.78 MB",
    },
    {
      platform: "linux-arm64",
      os: "Linux",
      arch: "ARM64",
      filename: "xipher_0.4.0_linux_arm64.tar.gz",
      sizeBytes: 4592599,
      sizeLabel: "4.38 MB",
    },
    {
      platform: "windows-amd64",
      os: "Windows",
      arch: "x86_64",
      filename: "xipher_0.4.0_windows_x86_64.zip",
      sizeBytes: 5021552,
      sizeLabel: "4.79 MB",
    },
  ],
};

export function getAssetUrl(filename: string) {
  return `${LATEST.baseUrl}${filename}`;
}

export function getAssetForPlatform(platform: string) {
  return LATEST.assets.find((a) => a.platform === platform);
}
