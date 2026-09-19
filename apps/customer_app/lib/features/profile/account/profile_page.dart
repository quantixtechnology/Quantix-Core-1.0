import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/contracts/store_dto.dart';
import '../../../../core/providers/store_context_provider.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/empty_state.dart';

class ProfilePage extends ConsumerWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final storeCtx = ref.watch(storeContextProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
        backgroundColor: AppTheme.light.colorScheme.primary,
        foregroundColor: Colors.white,
      ),
      body: storeCtx.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => EmptyState(
          message: 'Failed to load profile',
          actionLabel: 'Retry',
          onAction: () => ref.invalidate(storeContextProvider),
        ),
        data: (ctx) => _ProfileContent(business: ctx.business),
      ),
    );
  }
}

class _ProfileContent extends StatelessWidget {
  final BusinessBranding business;

  const _ProfileContent({required this.business});

  Future<void> _launchUrl(String url) async {
    final uri = Uri.parse(url);
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      debugPrint('Could not launch $url');
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // ── Account section (placeholder) ────────────────────────────────
        _SectionHeader(title: 'Account'),
        Card(
          child: Column(
            children: [
              ListTile(
                leading: const Icon(Icons.person_outline),
                title: const Text('Personal Information'),
                subtitle: const Text('Manage your name, email, phone'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () {
                  // TODO: Navigate to edit profile
                },
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.lock_outline),
                title: const Text('Security'),
                subtitle: const Text('Change password, manage 2FA'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () {},
              ),
            ],
          ),
        ),

        const SizedBox(height: 24),

        // ── Customer Support section ─────────────────────────────────────
        _SectionHeader(title: 'Customer Support'),
        Card(
          child: Column(
            children: [
              if (business.supportPhone != null && business.supportPhone!.isNotEmpty)
                _SupportTile(
                  icon: Icons.phone,
                  label: 'Customer Service Number',
                  value: business.supportPhone!,
                  onTap: () => _launchUrl('tel:${business.supportPhone}'),
                ),
              if (business.supportPhone2 != null && business.supportPhone2!.isNotEmpty)
                _SupportTile(
                  icon: Icons.phone,
                  label: 'Customer Service Number 2',
                  value: business.supportPhone2!,
                  onTap: () => _launchUrl('tel:${business.supportPhone2}'),
                ),
              if (business.supportEmail != null && business.supportEmail!.isNotEmpty)
                _SupportTile(
                  icon: Icons.email_outlined,
                  label: 'Support Email',
                  value: business.supportEmail!,
                  onTap: () => _launchUrl('mailto:${business.supportEmail}'),
                ),
              if (business.supportPhone == null || business.supportPhone!.isEmpty)
                if (business.supportPhone2 == null || business.supportPhone2!.isEmpty)
                  if (business.supportEmail == null || business.supportEmail!.isEmpty)
                    const Padding(
                      padding: EdgeInsets.all(16),
                      child: Text(
                        'No customer support contact information available.',
                        style: TextStyle(color: Colors.grey),
                      ),
                    ),
            ],
          ),
        ),

        const SizedBox(height: 24),

        // ── Business info ────────────────────────────────────────────────
        _SectionHeader(title: 'Business'),
        Card(
          child: Column(
            children: [
              ListTile(
                leading: const Icon(Icons.business_outlined),
                title: const Text('Business Name'),
                subtitle: Text(business.name),
              ),
              if (business.contactEmail != null && business.contactEmail!.isNotEmpty)
                ListTile(
                  leading: const Icon(Icons.email_outlined),
                  title: const Text('Contact Email'),
                  subtitle: Text(business.contactEmail!),
                  onTap: () => _launchUrl('mailto:${business.contactEmail}'),
                ),
              if (business.contactPhone != null && business.contactPhone!.isNotEmpty)
                ListTile(
                  leading: const Icon(Icons.phone_outlined),
                  title: const Text('Contact Phone'),
                  subtitle: Text(business.contactPhone!),
                  onTap: () => _launchUrl('tel:${business.contactPhone}'),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;

  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8, left: 4),
      child: Text(
        title,
        style: Theme.of(context).textTheme.titleMedium?.copyWith(
          fontWeight: FontWeight.bold,
          color: Theme.of(context).colorScheme.primary,
        ),
      ),
    );
  }
}

class _SupportTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final VoidCallback onTap;

  const _SupportTile({
    required this.icon,
    required this.label,
    required this.value,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: CircleAvatar(
        backgroundColor: Theme.of(context).colorScheme.primary.withOpacity(0.1),
        child: Icon(icon, color: Theme.of(context).colorScheme.primary, size: 20),
      ),
      title: Text(label, style: const TextStyle(fontWeight: FontWeight.w500)),
      subtitle: Text(value),
      trailing: const Icon(Icons.chevron_right),
      onTap: onTap,
    );
  }
}
