import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';

import 'core/api.dart';
import 'core/pending.dart';
import 'screens/alerts.dart';
import 'screens/directory.dart';
import 'screens/home.dart';
import 'screens/map_view.dart';
import 'screens/mine.dart';
import 'screens/profile.dart';
import 'screens/report.dart';

class IncidenciasApp extends StatelessWidget {
  const IncidenciasApp({super.key, required this.api, required this.pending, this.watchConnectivity = true});
  final ApiClient api;
  final PendingRepository pending;
  final bool watchConnectivity;

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Incidencias Ayacucho', debugShowCheckedModeBanner: false,
    theme: ThemeData(colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF087C72)), useMaterial3: true,
      scaffoldBackgroundColor: const Color(0xFFF6F9F8), appBarTheme: const AppBarTheme(backgroundColor: Color(0xFFF6F9F8))),
    home: CitizenShell(api: api, pending: pending, watchConnectivity: watchConnectivity),
  );
}

class CitizenShell extends StatefulWidget {
  const CitizenShell({super.key, required this.api, required this.pending, required this.watchConnectivity});
  final ApiClient api;
  final PendingRepository pending;
  final bool watchConnectivity;
  @override
  State<CitizenShell> createState() => _CitizenShellState();
}

class _CitizenShellState extends State<CitizenShell> with WidgetsBindingObserver {
  int selected = 0;
  StreamSubscription<List<ConnectivityResult>>? connection;
  late final SubmissionService submissions = SubmissionService(widget.api, widget.pending);
  final titles = const ['Inicio', 'Reportar', 'Mapa', 'Mis reportes', 'Alertas', 'Directorio', 'Perfil'];
  @override
  void initState() {
    super.initState();
    widget.api.addListener(_changed);
    WidgetsBinding.instance.addObserver(this);
    if (widget.watchConnectivity) {
      connection = Connectivity().onConnectivityChanged.listen((states) {
        if (states.any((state) => state != ConnectivityResult.none)) _retry();
      });
    }
  }
  void _changed() { if (mounted) setState(() {}); }
  Future<void> _retry() async {
    try { await submissions.retryPending(); if (mounted) setState(() {}); } catch (_) { /* Pendientes se conservan. */ }
  }
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _retry();
  }
  @override
  void dispose() {
    connection?.cancel();
    widget.api.removeListener(_changed);
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }
  Widget currentPage() => switch (selected) {
    0 => HomeScreen(pending: widget.pending, onReport: () => setState(() => selected = 1), onRetry: _retry),
    1 => ReportScreen(api: widget.api, submissions: submissions),
    2 => MapViewScreen(api: widget.api),
    3 => MineScreen(api: widget.api),
    4 => AlertsScreen(api: widget.api),
    5 => DirectoryScreen(api: widget.api),
    _ => ProfileScreen(api: widget.api),
  };
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(titles[selected]), actions: [
      Padding(padding: const EdgeInsets.only(right: 12), child: Center(child: Chip(
        avatar: const Icon(Icons.circle, size: 10, color: Color(0xFF087C72)),
        label: Text(widget.api.signedIn ? 'Mi cuenta' : 'Invitado')))),
    ]),
    drawer: Drawer(child: SafeArea(child: Column(children: [
      const ListTile(title: Text('Incidencias', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 22)),
          subtitle: Text('Piloto Ayacucho · Datos de prueba')),
      const Divider(),
      Expanded(child: ListView.builder(itemCount: titles.length, itemBuilder: (context, index) => ListTile(
        leading: Icon([Icons.home_outlined, Icons.add_location_alt_outlined, Icons.map_outlined,
          Icons.receipt_long_outlined, Icons.warning_amber_outlined, Icons.call_outlined,
          Icons.person_outline][index]),
        title: Text(titles[index]), selected: selected == index,
        onTap: () { Navigator.pop(context); setState(() => selected = index); },
      ))),
    ]))),
    body: SafeArea(child: currentPage()),
    bottomNavigationBar: NavigationBar(selectedIndex: selected < 4 ? selected : 0,
      onDestinationSelected: (index) => setState(() => selected = index), destinations: const [
        NavigationDestination(icon: Icon(Icons.home_outlined), label: 'Inicio'),
        NavigationDestination(icon: Icon(Icons.add_location_alt_outlined), label: 'Reportar'),
        NavigationDestination(icon: Icon(Icons.map_outlined), label: 'Mapa'),
        NavigationDestination(icon: Icon(Icons.receipt_long_outlined), label: 'Mis reportes'),
      ]),
  );
}
