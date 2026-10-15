import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';

// Keep async assertions bounded while allowing slower development machines.
configure({ asyncUtilTimeout: 5000 });
