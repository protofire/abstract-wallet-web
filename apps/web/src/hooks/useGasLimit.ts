import { SafeProvider } from '@safe-global/protocol-kit'
import { useEffect } from 'react'
import type Safe from '@safe-global/protocol-kit'
import { encodeSignatures } from '@/services/tx/encodeSignatures'
import type { SafeTransaction } from '@safe-global/types-kit'
import useAsync from '@safe-global/utils/hooks/useAsync'
import useChainId from '@/hooks/useChainId'
import { useWeb3ReadOnly } from '@/hooks/wallets/web3ReadOnly'
import chains from '@/config/chains'
import { useSigner } from './wallets/useWallet'
import { useSafeSDK } from './coreSDK/safeCoreSDK'
import useIsSafeOwner from './useIsSafeOwner'
import { Errors, logError } from '@/services/exceptions'
import useSafeInfo from './useSafeInfo'
import { estimateTxBaseGas } from '@safe-global/protocol-kit/dist/src/utils/transactions/gas'
import {
  getCompatibilityFallbackHandlerContract,
  getSimulateTxAccessorContract,
} from '@safe-global/protocol-kit/dist/src/contracts/safeDeploymentContracts'
import { type JsonRpcProvider } from 'ethers'
import type { ExtendedSafeInfo } from '@safe-global/store/slices/SafeInfo/types'

const getEncodedSafeTx = (
  safeSDK: Safe,
  safeTx: SafeTransaction,
  from: string | undefined,
  needsSignature: boolean,
): string | undefined => {
  const EXEC_TX_METHOD = 'execTransaction'

  // @ts-ignore union type is too complex
  return safeSDK
    .getContractManager()
    .safeContract?.encode(EXEC_TX_METHOD, [
      safeTx.data.to,
      safeTx.data.value,
      safeTx.data.data,
      safeTx.data.operation,
      safeTx.data.safeTxGas,
      safeTx.data.baseGas,
      safeTx.data.gasPrice,
      safeTx.data.gasToken,
      safeTx.data.refundReceiver,
      encodeSignatures(safeTx, from, needsSignature),
    ])
}

const GasMultipliers = {
  [chains.gno]: 1.3,
  [chains.zksync]: 20,
}

const incrementByGasMultiplier = (value: bigint, multiplier: number) => {
  return (value * BigInt(100 * multiplier)) / BigInt(100)
}

/**
 * Checks if a Safe is on zkSync based on its implementation address
 * @param implementationAddress - The Safe implementation address to check
 * @returns true if the Safe is on zkSync, false otherwise
 */
export const isSafeZkSync = (implementationAddress: string): boolean => {
  const zkSyncImplementationAddresses = [
    '0x1727c2c531cf966f902E5927b98490fDFb3b2b70',
    '0xB00ce5CCcdEf57e539ddcEd01DF43a13855d9910',
    '0x610fcA2e0279Fa1F8C00c8c2F71dF522AD469380',
    '0xC35F063962328aC65cED5D4c3fC5dEf8dec68dFa',
  ]

  const normalizedAddress = implementationAddress.trim().toLowerCase()
  const normalizedZkSyncAddresses = zkSyncImplementationAddresses.map((addr) => addr.toLowerCase())

  return normalizedZkSyncAddresses.includes(normalizedAddress)
}

/**
 * Estimates the gas limit for a transaction that will be executed on the zkSync network.
 *
 *  The rpc call for estimateGas is failing for the zkSync network, when the from address
 *  is a Safe. Quote from this discussion:
 *  https://github.com/zkSync-Community-Hub/zksync-developers/discussions/144
 *  ======================
 *  zkSync has native account abstraction and, under the hood, all accounts are a smart
 *  contract account. Even EOA use the DefaultAccount smart contract. All smart contract
 *  accounts on zkSync must be deployed using the createAccount or create2Account
 *  methods of the ContractDeployer system contract.
 *
 * When processing a transaction, the protocol checks the code of the from account and,
 * in this case, as Safe accounts are not deployed as native accounts on zkSync
 * (via createAccount or create2Account), it fails with the error above.
 * ======================
 *
 * We do some "magic" here by simulating the transaction on the SafeProxy contract
 *
 * @param safe
 * @param web3
 * @param safeSDK
 * @param safeTx
 */
const getGasLimitForZkSync = async (
  safe: ExtendedSafeInfo,
  web3: JsonRpcProvider,
  safeSDK: Safe,
  safeTx: SafeTransaction,
) => {
  // use a random EOA address as the from address
  // https://github.com/zkSync-Community-Hub/zksync-developers/discussions/144
  const fakeEOAFromAddress = '0x330d9F4906EDA1f73f668660d1946bea71f48827'
  const customContracts = safeSDK.getContractManager().contractNetworks?.[safe.chainId]
  const safeVersion = safeSDK.getContractVersion()
  const safeProvider = new SafeProvider({ provider: web3._getConnection().url })
  const fallbackHandlerContract = await getCompatibilityFallbackHandlerContract({
    safeProvider,
    safeVersion,
    customContracts,
    deploymentType: 'zksync',
  })

  const simulateTxAccessorContract = await getSimulateTxAccessorContract({
    safeProvider,
    safeVersion,
    customContracts,
    deploymentType: 'zksync',
  })

  // 2. Add a simulate call to the predicted SafeProxy as second transaction
  const transactionDataToEstimate: string = simulateTxAccessorContract.encode('simulate', [
    safeTx.data.to,
    // @ts-ignore
    safeTx.data.value,
    safeTx.data.data as `0x${string}`,
    safeTx.data.operation,
  ])

  const safeFunctionToEstimate: string = fallbackHandlerContract.encode('simulate', [
    simulateTxAccessorContract.getAddress(),
    transactionDataToEstimate as `0x${string}`,
  ])

  const gas = await web3.estimateGas({
    to: safe.address.value,
    from: fakeEOAFromAddress,
    value: '0',
    data: safeFunctionToEstimate,
  })

  // The estimateTxBaseGas function seems to estimate too low for zkSync
  const baseGas = incrementByGasMultiplier(
    BigInt(await estimateTxBaseGas(safeSDK, safeTx)),
    GasMultipliers[chains.zksync],
  )

  return BigInt(gas) + baseGas
}

const useGasLimit = (
  safeTx?: SafeTransaction,
): {
  gasLimit?: bigint
  gasLimitError?: Error
  gasLimitLoading: boolean
} => {
  const safeSDK = useSafeSDK()
  const web3ReadOnly = useWeb3ReadOnly()
  const { safe } = useSafeInfo()
  const safeAddress = safe.address.value
  const threshold = safe.threshold
  const wallet = useSigner()
  const walletAddress = wallet?.address
  const isOwner = useIsSafeOwner()
  const currentChainId = useChainId()
  const hasSafeTxGas = !!safeTx?.data?.safeTxGas

  const [gasLimit, gasLimitError, gasLimitLoading] = useAsync<bigint | undefined>(async () => {
    if (!safeAddress || !walletAddress || !safeSDK || !web3ReadOnly || !safeTx) return

    const encodedSafeTx = getEncodedSafeTx(
      safeSDK,
      safeTx,
      isOwner ? walletAddress : undefined,
      safeTx.signatures.size < threshold,
    )

    // if we are dealing with zksync and the walletAddress is a Safe, we have to do some magic
    // FIXME a new check to indicate ZKsync chain will be added to the config service and available under ChainInfo
    if (isSafeZkSync(safe.implementation.value ?? '0x') && (await web3ReadOnly.getCode(walletAddress)) !== '0x') {
      return getGasLimitForZkSync(safe, web3ReadOnly, safeSDK, safeTx)
    }

    return web3ReadOnly
      .estimateGas({
        to: safeAddress,
        from: walletAddress,
        data: encodedSafeTx,
      })
      .then((gasLimit) => {
        // Due to a bug in Nethermind estimation, we need to increment the gasLimit by 30%
        // when the safeTxGas is defined and not 0. Currently Nethermind is used only for Gnosis Chain.
        if (currentChainId === chains.gno && hasSafeTxGas) {
          return incrementByGasMultiplier(gasLimit, GasMultipliers[chains.gno])
        }

        return gasLimit
      })
  }, [
    safeAddress,
    walletAddress,
    safeSDK,
    web3ReadOnly,
    safeTx,
    isOwner,
    currentChainId,
    hasSafeTxGas,
    threshold,
    safe,
  ])

  useEffect(() => {
    if (gasLimitError) {
      logError(Errors._612, gasLimitError.message)
    }
  }, [gasLimitError])

  return { gasLimit, gasLimitError, gasLimitLoading }
}

export default useGasLimit
