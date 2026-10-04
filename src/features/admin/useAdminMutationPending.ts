import { useFetchers } from 'react-router'

export function useAdminMutationPending(): boolean {
  return useFetchers().some(
    (fetcher) =>
      fetcher.state !== 'idle' &&
      typeof fetcher.formData?.get('intent') === 'string',
  )
}
