import type { ReactElement } from 'react'
import { Alert, AlertTitle, Box, Link } from '@mui/material'
import { useRouter } from 'next/router'
import { AppRoutes } from '@/config/routes'
import useChainId from '@/hooks/useChainId'
import { SUNSET_BANNERS } from '@/config/constants.extra'

const ACCOUNTS_PAGE_MAX_WIDTH = 750

const getLayout = (pathname: string) => {
  switch (pathname) {
    case AppRoutes.home:
      return { px: 6, maxWidth: undefined, mx: 0 }
    case AppRoutes.welcome.accounts:
      return { px: 2, maxWidth: ACCOUNTS_PAGE_MAX_WIDTH, mx: 'auto' }
    default:
      return { px: 3, maxWidth: undefined, mx: 0 }
  }
}

const SunsetBanner = (): ReactElement | null => {
  const chainId = useChainId()
  const { pathname } = useRouter()
  const banner = SUNSET_BANNERS[chainId]

  if (!banner) return null

  const { px, maxWidth, mx } = getLayout(pathname)

  return (
    <Alert
      severity="warning"
      icon={false}
      sx={{ borderRadius: 0, px, '& .MuiAlert-message': { width: '100%' } }}
      data-testid="sunset-banner"
    >
      <Box sx={{ maxWidth, mx }}>
        <AlertTitle sx={{ mb: 0.5 }}>{banner.title}</AlertTitle>
        {banner.description}
        {banner.linkHref && (
          <>
            {' '}
            <Link href={banner.linkHref} target="_blank" rel="noopener noreferrer" fontWeight="bold">
              {banner.linkLabel}
            </Link>
          </>
        )}
      </Box>
    </Alert>
  )
}

export default SunsetBanner
