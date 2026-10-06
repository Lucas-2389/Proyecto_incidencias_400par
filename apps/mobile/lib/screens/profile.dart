import 'package:flutter/material.dart';

import '../core/api.dart';
import 'common.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key, required this.api});
  final ApiClient api;
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final form = GlobalKey<FormState>();
  final name = TextEditingController();
  final email = TextEditingController();
  final password = TextEditingController();
  bool register = false;
  bool busy = false;
  String? error;
  @override
  void dispose() { name.dispose(); email.dispose(); password.dispose(); super.dispose(); }
  Future<void> submit() async {
    if (!form.currentState!.validate()) { return; }
    setState(() { busy = true; error = null; });
    try {
      if (register) { await widget.api.register(name.text.trim(), email.text.trim(), password.text); }
      else { await widget.api.login(email.text.trim(), password.text); }
      if (mounted) setState(() {});
    } catch (issue) { if (mounted) setState(() => error = issue.toString()); }
    finally { if (mounted) setState(() => busy = false); }
  }
  @override
  Widget build(BuildContext context) {
    if (widget.api.signedIn) { return ListView(children: [ScreenPadding(child: Column(
      crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Mi perfil', style: Theme.of(context).textTheme.headlineSmall), const SizedBox(height: 12),
        Card(child: ListTile(leading: const Icon(Icons.person_outline), title: Text(widget.api.user?['name']?.toString() ?? 'Ciudadano'),
          subtitle: Text(widget.api.user?['email']?.toString() ?? 'Cuenta activa'))),
        const SizedBox(height: 12), OutlinedButton.icon(onPressed: () async { await widget.api.logout(); if (mounted) setState(() {}); },
          icon: const Icon(Icons.logout), label: const Text('Cerrar sesión')),
      ]))]); }
    return ListView(children: [ScreenPadding(child: Form(key: form, child: Column(
      crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(register ? 'Crear cuenta' : 'Iniciar sesión', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 8), const Text('Puedes reportar como invitado. Para consultar tus reportes y adjuntar fotos, inicia sesión.'),
        const SizedBox(height: 18), if (register) TextFormField(controller: name, decoration: const InputDecoration(labelText: 'Nombre'),
          validator: (value) => value == null || value.trim().isEmpty ? 'Escribe tu nombre' : null),
        TextFormField(controller: email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Correo'),
          validator: (value) => value != null && value.contains('@') ? null : 'Correo inválido'),
        TextFormField(controller: password, obscureText: true, decoration: const InputDecoration(labelText: 'Contraseña'),
          validator: (value) => value == null || value.length < (register ? 12 : 1) ? 'Contraseña inválida' : null),
        const SizedBox(height: 18), if (error != null) MessageCard(message: error!, icon: Icons.error_outline),
        FilledButton(onPressed: busy ? null : submit, child: Text(busy ? 'Espere…' : register ? 'Registrarme' : 'Ingresar')),
        TextButton(onPressed: () => setState(() { register = !register; error = null; }),
          child: Text(register ? 'Ya tengo cuenta' : 'Crear cuenta nueva')),
      ])))]);
  }
}
