FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl git build-essential pkg-config libssl-dev libudev-dev clang cmake python3 \
 && rm -rf /var/lib/apt/lists/*

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal
ENV PATH="/root/.cargo/bin:/root/.local/share/solana/install/active_release/bin:${PATH}"
RUN sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
RUN solana --version && cargo --version && rustc --version
RUN cargo install devnet-pow

WORKDIR /deploy
COPY entrypoint.sh /deploy/entrypoint.sh
RUN chmod +x /deploy/entrypoint.sh

ENV STOCKLANA_PROGRAM_CLUSTER=devnet
ENV STOCKLANA_PROGRAM_RPC_URL=https://api.devnet.solana.com
ENV PORT=8081
EXPOSE 8081

CMD ["/deploy/entrypoint.sh"]
