FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Install common tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gnupg \
    software-properties-common \
    unzip \
    git \
    python3-pip \
    python3-venv \
    wget \
    lsb-release \
    && rm -rf /var/lib/apt/lists/*

# Install Terraform
RUN wget -O- https://apt.releases.hashicorp.com/gpg \
      | gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" \
      > /etc/apt/sources.list.d/hashicorp.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends terraform \
    && rm -rf /var/lib/apt/lists/*

# Install Ansible
RUN apt-get update \
    && apt-get install -y --no-install-recommends ansible \
    && rm -rf /var/lib/apt/lists/*

# Install 1Password CLI
RUN set -eux; \
    ARCH="$(dpkg --print-architecture)"; \
    curl -sS https://downloads.1password.com/linux/keys/1password.asc \
      | gpg --dearmor --output /usr/share/keyrings/1password-archive-keyring.gpg; \
    echo "deb [arch=${ARCH} signed-by=/usr/share/keyrings/1password-archive-keyring.gpg] https://downloads.1password.com/linux/debian/${ARCH} stable main" \
      > /etc/apt/sources.list.d/1password.list; \
    mkdir -p /etc/debsig/policies/AC2D62742012EA22/; \
    curl -sS https://downloads.1password.com/linux/debian/debsig/1password.pol \
      > /etc/debsig/policies/AC2D62742012EA22/1password.pol; \
    mkdir -p /usr/share/debsig/keyrings/AC2D62742012EA22/; \
    curl -sS https://downloads.1password.com/linux/keys/1password.asc \
      | gpg --dearmor --output /usr/share/debsig/keyrings/AC2D62742012EA22/debsig.gpg; \
    apt-get update; \
    apt-get install -y --no-install-recommends 1password-cli; \
    rm -rf /var/lib/apt/lists/*

# Install kubectl (architecture-aware)
RUN set -eux; \
    ARCH="$(dpkg --print-architecture)"; \
    case "${ARCH}" in \
      amd64) KARCH="amd64" ;; \
      arm64) KARCH="arm64" ;; \
      *) echo "Unsupported arch: ${ARCH}" >&2; exit 1 ;; \
    esac; \
    curl -fsSLO "https://dl.k8s.io/release/$(curl -fsSL https://dl.k8s.io/release/stable.txt)/bin/linux/${KARCH}/kubectl"; \
    install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl; \
    rm kubectl

# Install Tailscale
RUN curl -fsSL https://tailscale.com/install.sh | sh

# Set up a default user
USER vscode