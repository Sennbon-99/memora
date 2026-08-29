// apps/web/src/features/host/useAuth.ts
// Session de l'hote.
//
// Le jeton d'acces vit en memoire, jamais dans le stockage local : une faille
// d'injection de script sait lire localStorage, pas une variable de module.
// Il est donc perdu a chaque rechargement, et retrouve au demarrage par la
// route de renouvellement, dont le cookie est inaccessible au JavaScript.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LoginInput, RegisterInput } from '@memora/types';
import { authApi, setAccessToken, type HostUser } from '../../lib/api.js';

export const meKey = ['host', 'me'] as const;

/**
 * Retrouve la session au demarrage.
 *
 * L'ordre compte : on renouvelle d'abord le jeton, puis on demande le profil.
 * Interroger /auth/me sans jeton echouerait alors que la session est valide.
 */
export function useSession() {
  return useQuery<HostUser | null>({
    queryKey: meKey,
    queryFn: async () => {
      try {
        const { accessToken } = await authApi.refresh();
        setAccessToken(accessToken);
        return (await authApi.me()).user;
      } catch {
        // Pas de cookie, ou cookie expire : personne n'est connecte.
        setAccessToken(null);
        return null;
      }
    },
    staleTime: Infinity,
    retry: false,
  });
}

export function useLogin() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: LoginInput) => authApi.login(input),
    onSuccess: ({ user, accessToken }) => {
      setAccessToken(accessToken);
      client.setQueryData(meKey, user);
    },
  });
}

export function useRegister() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: RegisterInput) => authApi.register(input),
    onSuccess: ({ user, accessToken }) => {
      setAccessToken(accessToken);
      client.setQueryData(meKey, user);
    },
  });
}

export function useLogout() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      setAccessToken(null);
      // On vide tout le cache : les evenements du compte precedent ne
      // doivent pas rester visibles a la connexion suivante.
      client.clear();
    },
  });
}
