import 'package:flutter/material.dart';
import 'common.dart';

class PresentationScreen extends StatelessWidget {
  const PresentationScreen({super.key});

  @override
  Widget build(BuildContext context) => ListView(children: [
    ScreenPadding(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Container(width: double.infinity, padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(26),
          gradient: const LinearGradient(colors: [Color(0xFF123B46), Color(0xFF209B86)])),
        child: const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(Icons.diversity_1_rounded, color: Color(0xFFAFF4DA), size: 64),
          SizedBox(height: 16), Text('Tu comunidad cuenta contigo',
            style: TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w800)),
          SizedBox(height: 10), Text('Reportar es sencillo. No necesitas registrarte ni recordar una contraseña.',
            style: TextStyle(color: Colors.white, fontSize: 16)),
        ])),
      const SizedBox(height: 20),
      const MessageCard(icon: Icons.edit_location_alt_rounded,
        message: '1. Describe qué ocurre y marca el lugar. Puedes usar el GPS o elegir un punto en el mapa.'),
      const MessageCard(icon: Icons.add_a_photo_rounded,
        message: '2. Añade una foto si ayuda. Es opcional: no te expongas a un peligro para conseguirla.'),
      const MessageCard(icon: Icons.check_circle_outline,
        message: '3. Envía y conserva la referencia que aparece al confirmar la recepción. Un pendiente todavía no ha sido recibido.'),
      const MessageCard(icon: Icons.lock_outline,
        message: 'Tu reporte es preliminar y no constituye una denuncia formal. Las fotos y los datos privados solo los consulta personal autorizado.'),
      const MessageCard(icon: Icons.phone_in_talk_rounded,
        message: '¿Hay peligro inmediato? Abre Contactos y llama al servicio correspondiente. Este piloto de prueba no despacha ayuda real.'),
    ])),
  ]);
}
