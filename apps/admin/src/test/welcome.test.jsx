import { expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Welcome from '../pages/Welcome';

it('presenta la plataforma y ofrece una entrada accesible al login institucional', async () => {
  render(<MemoryRouter><Routes><Route path="/" element={<Welcome />} /><Route path="/login" element={<h1>Acceso institucional</h1>} /></Routes></MemoryRouter>);
  expect(screen.getByRole('heading', { name: /Juntos por tu comunidad/ })).toBeInTheDocument();
  expect(screen.getByRole('img', { name: /Ilustración de una ciudadana/ })).toHaveAttribute('src', '/community-hero.png');
  expect(screen.getByRole('link', { name: 'Conocer la plataforma' })).toHaveAttribute('href', '#como-funciona');
  fireEvent.click(screen.getByRole('link', { name: /Entrar al panel institucional/ }));
  expect(await screen.findByRole('heading', { name: 'Acceso institucional' })).toBeInTheDocument();
});

it('orienta los contactos hacia Android y mantiene la web enfocada en entidades', () => {
  render(<MemoryRouter><Welcome /></MemoryRouter>);
  expect(screen.getByText(/Reporta sin cuenta y encuentra contactos de emergencia/)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Panel para las entidades' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Conserva tu referencia' })).toBeInTheDocument();
  expect(document.querySelectorAll('a[href^="tel:"]')).toHaveLength(0);
  expect(screen.queryByText(/Contraseña.*demo/i)).not.toBeInTheDocument();
});
