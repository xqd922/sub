# Subscription Conversion

This context names the subscription conversion domain: it accepts proxy subscription inputs and emits client-ready configuration outputs.

## Language

**Subscription**:
A source of proxy nodes. It can be a remote subscription URL, a single proxy URI, or a mixed remote list.
_Avoid_: feed, source link

**Proxy Node**:
One usable proxy endpoint with protocol-specific connection data.
_Avoid_: server, item

**Conversion**:
The act of turning a Subscription into a client-ready configuration response.
_Avoid_: processing, transform job

**Client Configuration**:
The rendered output consumed by Clash, sing-box, v2rayNG-compatible clients, or the browser preview.
_Avoid_: config blob, generated file

**Short Link**:
A stable compact URL that resolves back to a Subscription or Conversion URL.
_Avoid_: alias, redirect record
