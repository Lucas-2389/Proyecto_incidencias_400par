import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';

import 'core/api.dart';
import 'core/pending.dart';
import 'core/public_favorites.dart';
import 'screens/alerts.dart';
import 'screens/directory.dart';
import 'screens/home.dart';
import 'screens/map_view.dart';
import 'screens/presentation.dart';
import 'screens/report.dart';
import 'screens/profile.dart';
import 'screens/mine.dart';

class IncidenciasApp extends StatelessWidget {
  const IncidenciasApp({super.key, required this.api, required this.pending, this.watchConnectivity = true});
  final ApiClient api;
  final PendingRepository pending;
  final bool watchConnectivity;

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Incidencias Ayacucho', debugShowCheckedModeBanner: false,
    theme: ThemeData(
      colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF087C72)).copyWith(
        primary: const Color(0xFF086C63), secondary: const Color(0xFF365CC9)),
      useMaterial3: true,
      scaffoldBackgroundColor: const Color(0xFFEFF6F7),
      appBarTheme: const AppBarTheme(backgroundColor: Color(0xFFEFF6F7),
        foregroundColor: Color(0xFF123B46), centerTitle: false),
      cardTheme: CardThemeData(color: Colors.white, elevation: 0,
        margin: const EdgeInsets.symmetric(vertical: 6),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22),
          side: const BorderSide(color: Color(0xFFDCE9ED)))),
      inputDecorationTheme: InputDecorationTheme(filled: true, fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: Color(0xFFC8DCE1))),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: Color(0xFF086C63), width: 2))),
      filledButtonTheme: FilledButtonThemeData(style: FilledButton.styleFrom(
        minimumSize: const Size(48, 52), textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)))),
      navigationBarTheme: NavigationBarThemeData(backgroundColor: Colors.white,
        indicatorColor: const Color(0xFFC5EFE4),
        labelTextStyle: WidgetStateProperty.resolveWith((states) => TextStyle(
          fontSize: 12, fontWeight: states.contains(WidgetState.selected) ? FontWeight.w800 : FontWeight.w500))),
      listTileTheme: const ListTileThemeData(selectedTileColor: Color(0xFFD8F3EB),
        selectedColor: Color(0xFF086C63), contentPadding: EdgeInsets.symmetric(horizontal: 20, vertical: 6)),
    ),
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
  late final PublicFavorites favorites = PublicFavorites();
  final titles = const ['Inicio', 'Reportar', 'Mapa', 'Contactos', 'Alertas', 'Conoce la app', 'Perfil', 'Mis reportes'];
  late bool signedIn;
  String? identity;
  @override
  void initState() {
    super.initState();
    signedIn = widget.api.signedIn;
    identity = widget.api.user?['id']?.toString();
    widget.api.addListener(_changed);
    WidgetsBinding.instance.addObserver(this);
    if (widget.watchConnectivity) {
      connection = Connectivity().onConnectivityChanged.listen((states) {
        if (states.any((state) => state != ConnectivityResult.none)) _retry();
      });
    }
  }
  void _changed() {
    if (!mounted) return;
    final nextIdentity = widget.api.user?['id']?.toString();
    if (signedIn != widget.api.signedIn || identity != nextIdentity) {
      Navigator.of(context).popUntil((route) => route.isFirst);
      if (selected == 7 || (selected == 6 && !widget.api.signedIn)) selected = 0;
      if (!widget.api.signedIn && widget.api.sessionMessage != null) selected = 6;
    }
    setState(() {
      signedIn = widget.api.signedIn;
      identity = nextIdentity;
    });
  }
  void _navigate(int index) {
    if (index == 7 && !widget.api.signedIn) index = 6;
    setState(() => selected = index);
  }
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
    0 => HomeScreen(pending: widget.pending, onReport: () => _navigate(1), onRetry: _retry,
      onNavigate: _navigate),
    1 => ReportScreen(api: widget.api, submissions: submissions),
    2 => MapViewScreen(api: widget.api, favorites: favorites),
    3 => DirectoryScreen(api: widget.api),
    4 => AlertsScreen(api: widget.api),
    5 => const PresentationScreen(),
    6 => ProfileScreen(api: widget.api),
    7 when widget.api.signedIn => MineScreen(key: ValueKey(identity), api: widget.api),
    _ => ProfileScreen(api: widget.api),
  };
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(titles[selected]), actions: [
      Padding(padding: const EdgeInsets.only(right: 12), child: Center(child: ActionChip(
        tooltip: 'Abrir perfil', onPressed: () => _navigate(6),
        avatar: const Icon(Icons.circle, size: 10, color: Color(0xFF087C72)),
        label: Text(widget.api.signedIn ? (widget.api.user?['name']?.toString() ?? 'Ciudadano') : 'Sin cuenta')))),
    ]),
    drawer: Drawer(child: SafeArea(child: Column(children: [
      Container(width: double.infinity, padding: const EdgeInsets.all(24),
        decoration: const BoxDecoration(gradient: LinearGradient(colors: [Color(0xFF123B46), Color(0xFF087C72)])),
        child: const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(Icons.health_and_safety_rounded, size: 42, color: Color(0xFF9FF0D5)),
          SizedBox(height: 12), Text('Incidencias', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 24)),
          Text('Ayacucho · Piloto de prueba', style: TextStyle(color: Colors.white70)),
        ])),
      const Divider(),
      Expanded(child: ListView.builder(itemCount: widget.api.signedIn ? titles.length : titles.length - 1, itemBuilder: (context, index) => ListTile(
        leading: Icon([Icons.home_outlined, Icons.add_location_alt_outlined, Icons.map_outlined,
          Icons.call_outlined, Icons.warning_amber_outlined, Icons.info_outline, Icons.person_outline, Icons.history][index]),
        title: Text(titles[index]), selected: selected == index,
        onTap: () { Navigator.pop(context); _navigate(index); },
      ))),
    ]))),
    body: SafeArea(child: currentPage()),
    bottomNavigationBar: selected < 4 ? NavigationBar(selectedIndex: selected,
      onDestinationSelected: _navigate, destinations: const [
        NavigationDestination(icon: Icon(Icons.home_outlined), label: 'Inicio'),
        NavigationDestination(icon: Icon(Icons.add_location_alt_outlined), label: 'Reportar'),
        NavigationDestination(icon: Icon(Icons.map_outlined), label: 'Mapa'),
        NavigationDestination(icon: Icon(Icons.call_outlined), label: 'Contactos'),
      ]) : null,
  );
}
