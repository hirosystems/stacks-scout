# stacks-scout 📡

stacks-scout is a robust Stacks network scanner, implementing the [Stacks peer-to-peer protocol](https://github.com/stacksgov/sips/blob/main/sips/sip-003/sip-003-peer-network.md). It is designed to connect to, interact with, and monitor all possible nodes in the network, including NAT'd nodes that might not permit inbound connections. It logs comprehensive data about the network and Stacks nodes, paving the way for advanced network analytics and diagnostics.

## Features 🚀

- **Node Discovery:** Connects to all possible nodes on the Stacks network, including those that do not permit inbound connections.
- **Comprehensive Logging:** Collects a broad spectrum of data including block/microblock/mempool propagation statistics, hardfork versions, lag/response times, and geo-ip.
- **Prometheus Metrics Support:** Allows exporting of performance and application metrics in a format compatible with [Prometheus](https://prometheus.io/). This feature allows you to seamlessly integrate stacks-scout with your existing Prometheus setup for real-time monitoring and alerting. The metrics include but are not limited to node count, network latency, and block propagation times.
- **Network Analytics:** The collected data can be used to determine valuable information such as the rate of hardfork adoption, potential message propagation issues, _and more_.
- **Persistent Monitoring:** Provides continuous real-time updates of the network status, offering a comprehensive picture of the Stacks ecosystem.


## Getting Started 🏁

The easiest way to get started with stacks-scout is by using the provided Docker image, `hirosystems/stacks-scout`. Follow the steps below to pull the image and run stacks-scout:

```bash
# Pull the Docker image
docker pull hirosystems/stacks-scout

# Run the Docker image
docker run -p 30444:30444 hirosystems/stacks-scout
```
