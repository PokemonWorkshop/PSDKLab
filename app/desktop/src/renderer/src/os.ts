const OS = /Windows/i.test(navigator.userAgent)
  ? 'Windows'
  : /Mac/i.test(navigator.userAgent)
    ? 'macOS'
    : 'Linux';

/** Name of the tester's system, as shown in Settings > About and the test report. */
export const osName = () => OS;
