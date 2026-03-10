import React from 'react';
import { render } from '@testing-library/react';
import { SettingsProvider } from '../context/SettingsContext';

export const renderWithSettings = (ui) => {
    return render(<SettingsProvider>{ui}</SettingsProvider>);
};
