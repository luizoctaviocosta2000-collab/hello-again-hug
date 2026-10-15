/* eslint-disable */

// @ts-nocheck

import { Route as rootRouteImport } from './routes/__root'
import { Route as IndexRouteImport } from './routes/index'
import { Route as AgendaRouteImport } from './routes/agenda'
import { Route as ClientesRouteImport } from './routes/clientes'
import { Route as ComissoesRouteImport } from './routes/comissoes'
import { Route as ConfiguracoesRouteImport } from './routes/configuracoes'
import { Route as ImoveisRouteImport } from './routes/imoveis'
import { Route as IaRouteImport } from './routes/ia'
import { Route as LoginRouteImport } from './routes/login'
import { Route as NegociosRouteImport } from './routes/negocios'
import { Route as OportunidadesRouteImport } from './routes/oportunidades'
import { Route as VgvRouteImport } from './routes/vgv'
import { Route as PTokenRouteImport } from './routes/p.$token'

const IndexRoute = IndexRouteImport.update({ id: '/', path: '/', getParentRoute: () => rootRouteImport } as any)
const AgendaRoute = AgendaRouteImport.update({ id: '/agenda', path: '/agenda', getParentRoute: () => rootRouteImport } as any)
const ClientesRoute = ClientesRouteImport.update({ id: '/clientes', path: '/clientes', getParentRoute: () => rootRouteImport } as any)
const ComissoesRoute = ComissoesRouteImport.update({ id: '/comissoes', path: '/comissoes', getParentRoute: () => rootRouteImport } as any)
const ConfiguracoesRoute = ConfiguracoesRouteImport.update({ id: '/configuracoes', path: '/configuracoes', getParentRoute: () => rootRouteImport } as any)
const ImoveisRoute = ImoveisRouteImport.update({ id: '/imoveis', path: '/imoveis', getParentRoute: () => rootRouteImport } as any)
const IaRoute = IaRouteImport.update({ id: '/ia', path: '/ia', getParentRoute: () => rootRouteImport } as any)
const LoginRoute = LoginRouteImport.update({ id: '/login', path: '/login', getParentRoute: () => rootRouteImport } as any)
const NegociosRoute = NegociosRouteImport.update({ id: '/negocios', path: '/negocios', getParentRoute: () => rootRouteImport } as any)
const OportunidadesRoute = OportunidadesRouteImport.update({ id: '/oportunidades', path: '/oportunidades', getParentRoute: () => rootRouteImport } as any)
const VgvRoute = VgvRouteImport.update({ id: '/vgv', path: '/vgv', getParentRoute: () => rootRouteImport } as any)
const PTokenRoute = PTokenRouteImport.update({ id: '/p/$token', path: '/p/$token', getParentRoute: () => rootRouteImport } as any)

export interface FileRoutesByFullPath { '/': typeof IndexRoute; '/agenda': typeof AgendaRoute; '/clientes': typeof ClientesRoute; '/comissoes': typeof ComissoesRoute; '/configuracoes': typeof ConfiguracoesRoute; '/imoveis': typeof ImoveisRoute; '/ia': typeof IaRoute; '/login': typeof LoginRoute; '/negocios': typeof NegociosRoute; '/oportunidades': typeof OportunidadesRoute; '/vgv': typeof VgvRoute; '/p/$token': typeof PTokenRoute }
export interface FileRoutesByTo extends FileRoutesByFullPath {}
export interface FileRoutesById { __root__: typeof rootRouteImport; '/': typeof IndexRoute; '/agenda': typeof AgendaRoute; '/clientes': typeof ClientesRoute; '/comissoes': typeof ComissoesRoute; '/configuracoes': typeof ConfiguracoesRoute; '/imoveis': typeof ImoveisRoute; '/ia': typeof IaRoute; '/login': typeof LoginRoute; '/negocios': typeof NegociosRoute; '/oportunidades': typeof OportunidadesRoute; '/vgv': typeof VgvRoute; '/p/$token': typeof PTokenRoute }
export interface FileRouteTypes { fileRoutesByFullPath: FileRoutesByFullPath; fullPaths: keyof FileRoutesByFullPath; fileRoutesByTo: FileRoutesByTo; to: keyof FileRoutesByTo; id: keyof FileRoutesById; fileRoutesById: FileRoutesById }
export interface RootRouteChildren { IndexRoute: typeof IndexRoute; AgendaRoute: typeof AgendaRoute; ClientesRoute: typeof ClientesRoute; ComissoesRoute: typeof ComissoesRoute; ConfiguracoesRoute: typeof ConfiguracoesRoute; ImoveisRoute: typeof ImoveisRoute; IaRoute: typeof IaRoute; LoginRoute: typeof LoginRoute; NegociosRoute: typeof NegociosRoute; OportunidadesRoute: typeof OportunidadesRoute; VgvRoute: typeof VgvRoute; PTokenRoute: typeof PTokenRoute }

declare module '@tanstack/react-router' { interface FileRoutesByPath { '/': { id: '/'; path: '/'; fullPath: '/'; preLoaderRoute: typeof IndexRouteImport; parentRoute: typeof rootRouteImport }; '/agenda': { id: '/agenda'; path: '/agenda'; fullPath: '/agenda'; preLoaderRoute: typeof AgendaRouteImport; parentRoute: typeof rootRouteImport }; '/clientes': { id: '/clientes'; path: '/clientes'; fullPath: '/clientes'; preLoaderRoute: typeof ClientesRouteImport; parentRoute: typeof rootRouteImport }; '/comissoes': { id: '/comissoes'; path: '/comissoes'; fullPath: '/comissoes'; preLoaderRoute: typeof ComissoesRouteImport; parentRoute: typeof rootRouteImport }; '/configuracoes': { id: '/configuracoes'; path: '/configuracoes'; fullPath: '/configuracoes'; preLoaderRoute: typeof ConfiguracoesRouteImport; parentRoute: typeof rootRouteImport }; '/imoveis': { id: '/imoveis'; path: '/imoveis'; fullPath: '/imoveis'; preLoaderRoute: typeof ImoveisRouteImport; parentRoute: typeof rootRouteImport }; '/ia': { id: '/ia'; path: '/ia'; fullPath: '/ia'; preLoaderRoute: typeof IaRouteImport; parentRoute: typeof rootRouteImport }; '/login': { id: '/login'; path: '/login'; fullPath: '/login'; preLoaderRoute: typeof LoginRouteImport; parentRoute: typeof rootRouteImport }; '/negocios': { id: '/negocios'; path: '/negocios'; fullPath: '/negocios'; preLoaderRoute: typeof NegociosRouteImport; parentRoute: typeof rootRouteImport }; '/oportunidades': { id: '/oportunidades'; path: '/oportunidades'; fullPath: '/oportunidades'; preLoaderRoute: typeof OportunidadesRouteImport; parentRoute: typeof rootRouteImport }; '/vgv': { id: '/vgv'; path: '/vgv'; fullPath: '/vgv'; preLoaderRoute: typeof VgvRouteImport; parentRoute: typeof rootRouteImport }; '/p/$token': { id: '/p/$token'; path: '/p/$token'; fullPath: '/p/$token'; preLoaderRoute: typeof PTokenRouteImport; parentRoute: typeof rootRouteImport } } }

const rootRouteChildren: RootRouteChildren = { IndexRoute, AgendaRoute, ClientesRoute, ComissoesRoute, ConfiguracoesRoute, ImoveisRoute, IaRoute, LoginRoute, NegociosRoute, OportunidadesRoute, VgvRoute, PTokenRoute }
export const routeTree = rootRouteImport._addFileChildren(rootRouteChildren)._addFileTypes<FileRouteTypes>()

import type { getRouter } from './router.tsx'
import type { startInstance } from './start.ts'
declare module '@tanstack/react-start' { interface Register { ssr: true; router: Awaited<ReturnType<typeof getRouter>>; config: Awaited<ReturnType<typeof startInstance.getOptions>> } }
