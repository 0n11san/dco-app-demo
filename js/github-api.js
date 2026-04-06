// js/github-api.js
// GitHub REST API wrapper for reading/writing contracts.json
// Public repo: reads require no token; writes require a PAT

const GITHUB_API = {
  OWNER: CONFIG.GITHUB_OWNER,
  REPO: CONFIG.GITHUB_REPO,
  DATA_PATH: CONFIG.DATA_FILE,
  BASE_URL: 'https://api.github.com',

  // Build the full API URL for the data file
  _fileUrl: function() {
    return `${this.BASE_URL}/repos/${this.OWNER}/${this.REPO}/contents/${this.DATA_PATH}`;
  },

  // Fetch contracts from GitHub
  // Always fetches fresh (no caching) to ensure SHA is current
  // Returns { contracts: [...], sha: "..." }
  getContracts: async function() {
    const url = this._fileUrl();
    const resp = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        // Bust cache: GitHub CDN sometimes serves stale data
        'Cache-Control': 'no-cache'
      },
      // cache: 'no-store' ensures browser doesn't cache either
      cache: 'no-store'
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(`GitHub API error ${resp.status}: ${err.message || resp.statusText}`);
    }

    const data = await resp.json();
    // GitHub returns file content as base64-encoded string
    const decoded = atob(data.content.replace(/\n/g, ''));
    const contracts = JSON.parse(decoded);
    return { contracts, sha: data.sha };
  },

  // Save contracts to GitHub via PUT
  // sha: current file SHA (required for updates)
  // token: GitHub PAT (must have Contents: Read & Write)
  // Returns new sha
  saveContracts: async function(contracts, sha, token) {
    if (!token) throw new Error('GitHub token is required to save changes.');

    const url = this._fileUrl();
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(contracts, null, 2))));

    const body = {
      message: `Update contracts.json [${new Date().toISOString()}]`,
      content: content,
      sha: sha
    };

    const resp = await fetch(url, {
      method: 'PUT',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(`GitHub save error ${resp.status}: ${err.message || resp.statusText}`);
    }

    const result = await resp.json();
    return result.content.sha;
  }
};
