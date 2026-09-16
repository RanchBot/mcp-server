import native = require('fs-native-extensions');
import { withTokenLock } from '../../tokenStorage';

const attempt = native.tryLock;
let allowed = true;
let descriptor: number;
let release!: () => void;
const hold = new Promise<void>((resolve) => {
  release = resolve;
});
native.tryLock = (fd: number) => {
  descriptor = fd;
  if (!allowed) return false;
  const acquired = attempt(fd);
  if (!acquired && process.argv[3] === 'barrier') {
    allowed = false;
    process.send?.('contended');
  }
  return acquired;
};
process.on('message', (message) => {
  if (message === 'go') {
    // After this barrier, retries run normally even while another contender owns the lock.
    native.tryLock = attempt;
    allowed = true;
  }
  if (message === 'probe') process.send?.(attempt(descriptor) ? 'probe:free' : 'probe:held');
  if (message === 'release') release();
});
withTokenLock(async () => {
  process.send?.('entered');
  await hold;
}, process.argv[2]).then(
  () => process.disconnect?.(),
  (error: Error) => {
    process.stderr.write(error.message);
    process.exitCode = 1;
    process.disconnect?.();
  },
);
