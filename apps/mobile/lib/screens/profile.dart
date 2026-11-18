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
  void dispose() {
    name.dispose();
    email.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (busy || !form.currentState!.validate()) {
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      if (register) {
        await widget.api.register(
          name.text.trim(),
          email.text.trim(),
          password.text,
        );
      } else {
        await widget.api.login(email.text.trim(), password.text);
      }
      password.clear();
    } catch (issue) {
      if (mounted) {
        setState(() => error = issue.toString());
      }
    } finally {
      if (mounted) {
        setState(() => busy = false);
      }
    }
  }

  void open(Widget page) =>
      Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => page));
  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.api,
    builder: (context, _) {
      final api = widget.api;
      final feedback = <Widget>[
        if (api.restoring)
          const LinearProgressIndicator(semanticsLabel: 'Recuperando sesión'),
        if (api.sessionError != null) ...[
          MessageCard(message: api.sessionError!, icon: Icons.wifi_off),
          TextButton(
            onPressed: api.restoring ? null : api.restore,
            child: const Text('Reintentar'),
          ),
          const SizedBox(height: 24),
        ],
      ];
      if (api.signedIn) {
        return ListView(
          padding: const EdgeInsets.all(24),
          children: [
            ...feedback,
            Text(
              'Mi perfil',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 24),
            Text(
              api.user?['name']?.toString() ?? 'Ciudadano',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(api.user?['email']?.toString() ?? ''),
            const SizedBox(height: 32),
            Card(
              child: ListTile(
                leading: const Icon(Icons.person_outline),
                title: const Text('Datos personales'),
                subtitle: const Text('Nombre y teléfono'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => open(PersonalDataScreen(api: api)),
              ),
            ),
            const SizedBox(height: 16),
            Card(
              child: ListTile(
                leading: const Icon(Icons.lock_outline),
                title: const Text('Seguridad'),
                subtitle: const Text('Cambiar contraseña'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => open(ChangePasswordScreen(api: api)),
              ),
            ),
            const SizedBox(height: 32),
            OutlinedButton.icon(
              onPressed: api.logout,
              icon: const Icon(Icons.logout),
              label: const Text('Cerrar sesión'),
            ),
          ],
        );
      }
      return ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Form(
            key: form,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                ...feedback,
                if (api.sessionMessage != null) ...[
                  MessageCard(message: api.sessionMessage!),
                  const SizedBox(height: 24),
                ],
                Text(
                  register ? 'Crear cuenta' : 'Iniciar sesión',
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: 12),
                const Text(
                  'Puedes reportar sin cuenta. Ingresa para consultar tus reportes y mantener tus datos de contacto.',
                ),
                const SizedBox(height: 32),
                if (register) ...[
                  TextFormField(
                    controller: name,
                    textInputAction: TextInputAction.next,
                    decoration: const InputDecoration(labelText: 'Nombre'),
                    validator: (value) => value == null || value.trim().isEmpty
                        ? 'Escribe tu nombre'
                        : null,
                  ),
                  const SizedBox(height: 16),
                ],
                TextFormField(
                  controller: email,
                  keyboardType: TextInputType.emailAddress,
                  autofillHints: const [AutofillHints.email],
                  textInputAction: TextInputAction.next,
                  decoration: const InputDecoration(labelText: 'Correo'),
                  validator: (value) =>
                      value != null &&
                          RegExp(
                            r'^[^\s@]+@[^\s@]+\.[^\s@]+$',
                          ).hasMatch(value.trim())
                      ? null
                      : 'Escribe un correo válido',
                ),
                const SizedBox(height: 16),
                AccountPasswordField(
                  controller: password,
                  label: 'Contraseña',
                  isNew: register,
                ),
                const SizedBox(height: 24),
                if (error != null) ...[
                  MessageCard(message: error!, icon: Icons.error_outline),
                  const SizedBox(height: 16),
                ],
                FilledButton(
                  onPressed: busy || api.restoring ? null : submit,
                  child: Text(
                    busy
                        ? 'Espere…'
                        : register
                        ? 'Registrarme'
                        : 'Ingresar',
                  ),
                ),
                const SizedBox(height: 16),
                TextButton(
                  onPressed: busy
                      ? null
                      : () => setState(() {
                          register = !register;
                          error = null;
                        }),
                  child: Text(
                    register ? 'Ya tengo cuenta' : 'Crear cuenta nueva',
                  ),
                ),
              ],
            ),
          ),
        ],
      );
    },
  );
}

class PersonalDataScreen extends StatefulWidget {
  const PersonalDataScreen({super.key, required this.api});
  final ApiClient api;
  @override
  State<PersonalDataScreen> createState() => _PersonalDataScreenState();
}

class _PersonalDataScreenState extends State<PersonalDataScreen> {
  final form = GlobalKey<FormState>();
  late final name = TextEditingController(
    text: widget.api.user?['name']?.toString() ?? '',
  );
  late final phone = TextEditingController(
    text: widget.api.user?['phone']?.toString() ?? '',
  );
  bool busy = false;
  String? message;
  bool failed = false;
  @override
  void dispose() {
    name.dispose();
    phone.dispose();
    super.dispose();
  }

  Future<void> save() async {
    if (busy || !form.currentState!.validate()) {
      return;
    }
    setState(() {
      busy = true;
      message = null;
    });
    try {
      await widget.api.updateProfile(name.text, phone.text);
      if (mounted) {
        setState(() {
          failed = false;
          message = 'Datos guardados';
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          failed = true;
          message = error.toString();
        });
      }
    } finally {
      if (mounted) {
        setState(() => busy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Datos personales')),
    body: SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Form(
            key: form,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  widget.api.user?['email']?.toString() ?? '',
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
                const SizedBox(height: 32),
                TextFormField(
                  controller: name,
                  decoration: const InputDecoration(labelText: 'Nombre'),
                  maxLength: 150,
                  validator: (value) => value == null || value.trim().isEmpty
                      ? 'Escribe tu nombre'
                      : null,
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: phone,
                  keyboardType: TextInputType.phone,
                  maxLength: 20,
                  decoration: const InputDecoration(
                    labelText: 'Teléfono (opcional)',
                    helperText: 'Se completará en tus nuevos reportes.',
                  ),
                  validator: validateContactPhone,
                ),
                const SizedBox(height: 24),
                if (message != null) ...[
                  MessageCard(
                    message: message!,
                    icon: failed
                        ? Icons.error_outline
                        : Icons.check_circle_outline,
                  ),
                  const SizedBox(height: 16),
                ],
                FilledButton(
                  onPressed: busy ? null : save,
                  child: Text(busy ? 'Guardando…' : 'Guardar cambios'),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

class ChangePasswordScreen extends StatefulWidget {
  const ChangePasswordScreen({super.key, required this.api});
  final ApiClient api;
  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final form = GlobalKey<FormState>();
  final current = TextEditingController();
  final password = TextEditingController();
  final confirmation = TextEditingController();
  bool busy = false;
  String? error;
  @override
  void dispose() {
    current.dispose();
    password.dispose();
    confirmation.dispose();
    super.dispose();
  }

  Future<void> save() async {
    if (busy || !form.currentState!.validate()) {
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.api.changePassword(current.text, password.text);
      if (!mounted) {
        return;
      }
      current.clear();
      password.clear();
      confirmation.clear();
    } catch (issue) {
      if (mounted) {
        setState(
          () => error =
              'No se pudo confirmar el cambio: $issue. Si perdiste la conexión, intenta ingresar de nuevo.',
        );
      }
    } finally {
      if (mounted) {
        setState(() => busy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Cambiar contraseña')),
    body: SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Form(
            key: form,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                AccountPasswordField(
                  controller: current,
                  label: 'Contraseña actual',
                ),
                const SizedBox(height: 16),
                AccountPasswordField(
                  controller: password,
                  label: 'Nueva contraseña',
                  isNew: true,
                ),
                const SizedBox(height: 16),
                AccountPasswordField(
                  controller: confirmation,
                  label: 'Confirmar contraseña',
                  validator: (value) => value != password.text
                      ? 'Las contraseñas no coinciden'
                      : null,
                ),
                const SizedBox(height: 24),
                const Text(
                  'Al guardar tendrás que iniciar sesión nuevamente en tus dispositivos.',
                ),
                const SizedBox(height: 24),
                if (error != null) ...[
                  MessageCard(message: error!, icon: Icons.error_outline),
                  const SizedBox(height: 16),
                ],
                FilledButton(
                  onPressed: busy ? null : save,
                  child: Text(busy ? 'Guardando…' : 'Cambiar contraseña'),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

class AccountPasswordField extends StatefulWidget {
  const AccountPasswordField({
    super.key,
    required this.controller,
    required this.label,
    this.isNew = false,
    this.validator,
  });
  final TextEditingController controller;
  final String label;
  final bool isNew;
  final FormFieldValidator<String>? validator;
  @override
  State<AccountPasswordField> createState() => _AccountPasswordFieldState();
}

class _AccountPasswordFieldState extends State<AccountPasswordField> {
  bool obscured = true;
  @override
  Widget build(BuildContext context) => TextFormField(
    controller: widget.controller,
    obscureText: obscured,
    autocorrect: false,
    enableSuggestions: false,
    decoration: InputDecoration(
      labelText: widget.label,
      helperText: widget.isNew ? 'Entre 12 y 128 caracteres' : null,
      suffixIcon: IconButton(
        tooltip: obscured
            ? 'Mostrar ${widget.label.toLowerCase()}'
            : 'Ocultar ${widget.label.toLowerCase()}',
        onPressed: () => setState(() => obscured = !obscured),
        icon: Icon(
          obscured ? Icons.visibility_outlined : Icons.visibility_off_outlined,
        ),
      ),
    ),
    validator:
        widget.validator ??
        (value) {
          if (value == null || value.isEmpty) {
            return 'Escribe tu contraseña';
          }
          if (widget.isNew && (value.length < 12 || value.length > 128)) {
            return 'Usa entre 12 y 128 caracteres';
          }
          return null;
        },
  );
}
