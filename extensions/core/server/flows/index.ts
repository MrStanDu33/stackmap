// The core's flow building blocks, for extensions whose flows start from DNS or reach listeners (NAT, tunnels…).
export { deriveDnsFlows, dnsFlowDeriver, dnsNamesByAddress, reachableListeners } from './dns';
export type { AddressNames, DnsFlowEntities } from './dns';
