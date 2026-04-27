import type { ReactElement, ReactNode } from 'react'
import { SvgIcon, Typography } from '@mui/material'
import GitHubIcon from '@mui/icons-material/GitHub'
import Link from 'next/link'
import { useRouter } from 'next/router'
import css from './styles.module.css'
import { AppRoutes } from '@/config/routes'
import ExternalLink from '../ExternalLink'
import MUILink from '@mui/material/Link'
import { HELP_PROTOFIRE_URL } from '@/config/constants'
import packageJson from '../../../../package.json'
import ProtofireLogo from '@/public/images/protofire-logo.svg'
import type { FooterProps } from './footer.type'

const footerPages = [
  AppRoutes.settings.index,
  AppRoutes.imprint,
  AppRoutes.privacy,
  AppRoutes.cookie,
  AppRoutes.terms,
  AppRoutes.licenses,
]

const FooterLink = ({ children, href }: { children: ReactNode; href: string }): ReactElement => {
  return href ? (
    <Link href={href} passHref legacyBehavior>
      <MUILink>{children}</MUILink>
    </Link>
  ) : (
    <MUILink>{children}</MUILink>
  )
}

const Footer: React.FC<FooterProps> = ({
  forceShow,
  // preferences = true,
  versionIcon = true,
  helpCenter = true,
  className = css.container,
}): ReactElement | null => {
  const router = useRouter()
  const initialYear = 2025
  const currentYear = new Date().getFullYear()
  const copyrightYear = initialYear === currentYear ? initialYear : `${initialYear}–${currentYear}`

  if (!footerPages.some((path) => router.pathname.startsWith(path)) && !forceShow) {
    return null
  }

  const getHref = (path: string): string => {
    return router.pathname === path ? '' : path
  }

  return (
    <footer className={className}>
      <ul>
          <>
            <li>
              <Typography variant="caption">&copy;{copyrightYear} Abstract Safe</Typography>
            </li>
            <li>
              <FooterLink href={getHref(AppRoutes.terms)}>Terms</FooterLink>
            </li>
             {/* <li>
              <FooterLink href={getHref(AppRoutes.privacy)}>Privacy</FooterLink>
            </li>
            <li>
              <FooterLink href={getHref(AppRoutes.licenses)}>Licenses</FooterLink>
            </li>
            <li>
              <FooterLink href={getHref(AppRoutes.imprint)}>Imprint</FooterLink>
            </li> */}
            <li>
              <FooterLink href={getHref(AppRoutes.cookie)}>Cookie policy</FooterLink>
            </li>
            {/* {preferences && (
              <li>
                <FooterLink href={getHref(AppRoutes.settings.index)}>Preferences</FooterLink>
              </li>
            )} */}
            {helpCenter && (
              <li>
                <ExternalLink href={HELP_PROTOFIRE_URL} noIcon sx={{ span: { textDecoration: 'underline' } }}>
                  Help
                </ExternalLink>
              </li>
            )}
            <li>
              <ExternalLink href={`${packageJson.homepage}/releases/tag/v${packageJson.version}`} noIcon>
                {versionIcon && <SvgIcon component={GitHubIcon} inheritViewBox fontSize="inherit" sx={{ mr: 0.5 }} />} v
                {packageJson.version}
              </ExternalLink>
            </li>
            <li>
              <Typography variant="caption">
                Supported by{' '}
                <SvgIcon
                  component={ProtofireLogo}
                  inheritViewBox
                  fontSize="small"
                  sx={{ verticalAlign: 'middle', mx: 0.5 }}
                />
                <ExternalLink
                  href="https://protofire.io/services/solution/safe-deployment"
                  sx={{ textDecoration: 'none' }}
                  noIcon
                >
                  Protofire
                </ExternalLink>
              </Typography>
            </li>
          </>
          {/* <li>
            <AppstoreButton placement="footer" />
          </li> */}
        </ul>
      </footer>
    )
}

export default Footer
