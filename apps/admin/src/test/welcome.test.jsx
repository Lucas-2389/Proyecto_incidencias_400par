import { expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Welcome from '../pages/Welcome';

it('presenta la plataforma y ofrece una entrada accesible al login', async () => {
  render(<MemoryRouter><Routes><Route path="/" element={<Welcome />} /><Route path="/login" element={<h1>Acceso institucional</h1>} /></Routes></MemoryRouter>);
  expect(screen.getByRole('heading', { name: /Juntos por tu comunidad/ })).toBeInTheDocument();
  expect(screen.getByRole('img', { name: /Ilustración de una ciudadana/ })).toHaveAttribute('src', '/community-hero.png');
  expect(screen.getByRole('link', { name: 'Conocer la plataforma' })).toHaveAttribute('href', '#como-funciona');
  fireEvent.click(screen.getByRole('link', { name: /Entrar al panel institucional/ }));
  expect(await screen.findByRole('heading', { name: 'Acceso institucional' })).toBeInTheDocument();
});

it('ofrece números oficiales como enlaces telefónicos sin requerir sesión', () => {
  render(<MemoryRouter><Welcome /></MemoryRouter>);
  for (const [number, name] of [['105', 'Policía Nacional'], ['116', 'Bomberos'], ['106', 'SAMU'], ['100', 'Línea 100']]) {
    expect(screen.getByRole('link', { name: `Llamar al ${number}, ${name}` })).toHaveAttribute('href', `tel:${number}`);
  }
  expect(screen.getByText(/Serenazgo: el número depende/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Teléfonos de emergencia · Gob.pe/ })).toHaveAttribute('href', 'https://www.gob.pe/547-telefonos-de-emergencia');
});
