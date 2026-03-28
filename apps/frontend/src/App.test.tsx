import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from './App';
import '@testing-library/jest-dom';

describe('App', () => {
  it('renders landing page heading', () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /Trasa Foundation/i })).toBeInTheDocument();
  });
});
