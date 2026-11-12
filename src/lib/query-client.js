import { QueryClient } from '@tanstack/react-query';

// Cada consulta a la base de datos cuenta en la factura de Neon (transferencia de datos).
// - staleTime: lo leído vale 30 s; al cambiar de página dentro de ese tiempo no se vuelve a pedir.
//   Lo que se guarda en la app se refresca igual al momento (las pantallas invalidan sus consultas al guardar).
// - POLL: cada cuánto se repiten las consultas que se actualizan solas (solo con la pestaña a la vista).
export const POLL = { medium: 3 * 60_000, slow: 5 * 60_000 };

export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			staleTime: 30_000,
			retry: 1,
		},
	},
});
