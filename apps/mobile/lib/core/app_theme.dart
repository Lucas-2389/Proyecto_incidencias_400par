import 'package:flutter/material.dart';

abstract final class AppColors {
  static const blue = Color(0xFF002FA7);
  static const ink = Color(0xFF142338);
  static const canvas = Color(0xFFF7F7F8);
  static const line = Color(0xFFC4CEDE);
}

ThemeData citizenTheme() {
  final scheme = ColorScheme.fromSeed(seedColor: AppColors.blue).copyWith(
    primary: AppColors.blue,
    onPrimary: Colors.white,
    secondary: AppColors.blue,
    surface: Colors.white,
    onSurface: AppColors.ink,
    outline: AppColors.line,
  );
  final shape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(16));
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    fontFamily: 'Helvetica Neue',
    fontFamilyFallback: const ['Arial', 'Roboto'],
    scaffoldBackgroundColor: AppColors.canvas,
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      foregroundColor: AppColors.ink,
      centerTitle: false,
      titleTextStyle: TextStyle(
        color: AppColors.ink,
        fontSize: 21,
        fontWeight: FontWeight.w800,
      ),
    ),
    cardTheme: CardThemeData(
      color: Colors.white,
      elevation: 0,
      margin: const EdgeInsets.symmetric(vertical: 6),
      shape: shape.copyWith(side: const BorderSide(color: AppColors.line)),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: AppColors.line),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: AppColors.blue, width: 2),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(48, 54),
        shape: shape,
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(48, 50),
        shape: shape,
        side: const BorderSide(color: AppColors.blue),
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.white,
      indicatorColor: AppColors.blue.withValues(alpha: .12),
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => TextStyle(
          color: states.contains(WidgetState.selected)
              ? AppColors.blue
              : AppColors.ink,
          fontSize: 12,
          fontWeight: states.contains(WidgetState.selected)
              ? FontWeight.w800
              : FontWeight.w500,
        ),
      ),
    ),
    listTileTheme: ListTileThemeData(
      selectedTileColor: AppColors.blue.withValues(alpha: .08),
      selectedColor: AppColors.blue,
      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
    ),
    chipTheme: ChipThemeData(
      side: const BorderSide(color: AppColors.line),
      selectedColor: AppColors.blue.withValues(alpha: .12),
      shape: shape,
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: AppColors.ink,
      shape: shape,
    ),
    dividerTheme: const DividerThemeData(color: AppColors.line, thickness: 1),
  );
}
