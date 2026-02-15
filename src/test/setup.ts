import '@testing-library/jest-dom';

// Mock ResizeObserver for tests
// global.ResizeObserver = class ResizeObserver {
//   observe() {}
//   unobserve() {}
//   disconnect() {}
// };

// // Mock crypto.randomUUID for tests
// if (!global.crypto) {
//   global.crypto = {} as Crypto;
// }
// if (!global.crypto.randomUUID) {
//   globalThis.crypto.randomUUID = () => {
//     return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
//       const r = (Math.random() * 16) | 0;
//       const v = c === 'x' ? r : (r & 0x3) | 0x8;
//       return v.toString(16);
//     });
//   };
// }
