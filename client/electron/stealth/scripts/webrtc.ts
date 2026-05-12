export function buildWebrtcScript() {
  return `
  const privateIpPattern = /(?:^|\\s)((10\\.)|(192\\.168\\.)|(172\\.(1[6-9]|2\\d|3[01])\\.))/;
  const filterSdp = (sdp) => String(sdp || '')
    .split(/\\r?\\n/)
    .filter((line) => !(line.startsWith('a=candidate:') && privateIpPattern.test(line)))
    .join('\\r\\n');

  if (window.RTCPeerConnection) {
    const patchDescriptionFactory = (key) => {
      const original = RTCPeerConnection.prototype[key];
      if (!original) {
        return;
      }

      RTCPeerConnection.prototype[key] = async function (...args) {
        const description = await original.apply(this, args);
        if (description && description.sdp) {
          return { ...description, sdp: filterSdp(description.sdp) };
        }
        return description;
      };
    };

    patchDescriptionFactory('createOffer');
    patchDescriptionFactory('createAnswer');
  }
`;
}
