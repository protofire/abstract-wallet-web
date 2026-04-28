import { getReadOnlyGnosisSafeContract } from '@/services/contracts/safeContracts'
import { SENTINEL_ADDRESS } from '@safe-global/protocol-kit/dist/src/utils/constants'
import type { ChainInfo, TransactionDetails } from '@safe-global/safe-gateway-typescript-sdk'
import { getTransactionDetails } from '@safe-global/safe-gateway-typescript-sdk'
import type { AddOwnerTxParams, RemoveOwnerTxParams, SwapOwnerTxParams } from '@safe-global/protocol-kit'
import type { MetaTransactionData, SafeTransaction, SafeTransactionDataPartial } from '@safe-global/types-kit'
import extractTxInfo from '../extractTxInfo'
import { getAndValidateSafeSDK } from './sdk'

/**
 * Create a transaction from raw params
 */
export const createTx = async (txParams: SafeTransactionDataPartial, nonce?: number): Promise<SafeTransaction> => {
  if (nonce !== undefined) txParams = { ...txParams, nonce }
  const safeSDK = getAndValidateSafeSDK()
  return safeSDK.createTransaction({ transactions: [txParams] })
}

/**
 * Create a multiSendCallOnly transaction from an array of MetaTransactionData and options
 * If only one tx is passed it will be created without multiSend and without onlyCalls.
 */
export const createMultiSendCallOnlyTx = async (txParams: MetaTransactionData[]): Promise<SafeTransaction> => {
  const safeSDK = getAndValidateSafeSDK()
  return safeSDK.createTransaction({ transactions: txParams, onlyCalls: true })
}

/**
 * Create a multiSendCallOnly transaction with zkSync workaround
 * If the Safe is on zkSync, it will use the correct MultiSendCallOnly address
 */
export const createMultiSendCallOnlyTxWithZkSyncWorkaround = async (
  txParams: MetaTransactionData[],
  safeImplementationAddress?: string,
): Promise<SafeTransaction> => {
  const safeSDK = getAndValidateSafeSDK()

  // Import the isSafeZkSync function dynamically to avoid circular dependencies
  const { isSafeZkSync } = await import('@/hooks/useGasLimit')

  // If this is a zkSync Safe, we need to create the transaction with the correct address
  if (safeImplementationAddress && isSafeZkSync(safeImplementationAddress)) {
    // Define the address mappings for zkSync
    const addressMappings = {
      '0xA1dabEF33b3B82c7814B6D82A79e50F4AC44102B': '0xf220D3b4DFb23C4ade8C88E526C1353AbAcbC38F',
      '0x40A2aCCbd92BCA938b02010E17A5b8929b49130D': '0xf220D3b4DFb23C4ade8C88E526C1353AbAcbC38F',
      '0x9641d764fc13c8B624c04430C7356C1C7C8102e2': '0x0408EF011960d02349d50286D20531229BCef773',
    }

    // Create the transaction normally first
    const transaction = await safeSDK.createTransaction({ transactions: txParams, onlyCalls: true })

    // Check if the transaction is going to a wrong address that needs correction
    const wrongAddress = transaction.data.to
    const correctAddress = addressMappings[wrongAddress as keyof typeof addressMappings]

    if (correctAddress) {
      // Get the MultiSendCallOnly contract from the contract manager
      const contractManager = safeSDK.getContractManager()
      const multiSendCallOnlyContract = contractManager.multiSendCallOnlyContract

      if (multiSendCallOnlyContract) {
        // The transaction.data.data already contains the encoded MultiSend call
        // We just need to change the target address and use DelegateCall operation
        const correctedTx = {
          to: correctAddress,
          value: '0',
          data: transaction.data.data, // Use the original MultiSend data directly
          operation: 1, // DelegateCall operation (like the working transaction)
          safeTxGas: transaction.data.safeTxGas || 0,
          baseGas: transaction.data.baseGas || 0,
          gasPrice: transaction.data.gasPrice || 0,
          gasToken: transaction.data.gasToken || '0x0000000000000000000000000000000000000000',
          refundReceiver: transaction.data.refundReceiver || '0x0000000000000000000000000000000000000000',
          nonce: transaction.data.nonce,
        }

        // Create a new SafeTransaction with the corrected data
        return safeSDK.createTransaction({ transactions: [correctedTx] })
      }
    }
  }

  // For non-zkSync or if address is already correct, create normally
  return safeSDK.createTransaction({ transactions: txParams, onlyCalls: true })
}

export const createRemoveOwnerTx = async (txParams: RemoveOwnerTxParams): Promise<SafeTransaction> => {
  const safeSDK = getAndValidateSafeSDK()
  return safeSDK.createRemoveOwnerTx(txParams)
}

export const createAddOwnerTx = async (
  chain: ChainInfo,
  isDeployed: boolean,
  txParams: AddOwnerTxParams,
): Promise<SafeTransaction> => {
  const safeSDK = getAndValidateSafeSDK()
  if (isDeployed) return safeSDK.createAddOwnerTx(txParams)

  const safeVersion = safeSDK.getContractVersion()

  const contract = await getReadOnlyGnosisSafeContract(chain, safeVersion)
  // @ts-ignore
  const data = contract.encode('addOwnerWithThreshold', [txParams.ownerAddress, txParams.threshold])

  const tx = {
    to: await safeSDK.getAddress(),
    value: '0',
    data,
  }

  return safeSDK.createTransaction({
    transactions: [tx],
  })
}

export const createSwapOwnerTx = async (
  chain: ChainInfo,
  isDeployed: boolean,
  txParams: SwapOwnerTxParams,
): Promise<SafeTransaction> => {
  const safeSDK = getAndValidateSafeSDK()
  if (isDeployed) return safeSDK.createSwapOwnerTx(txParams)

  const safeVersion = safeSDK.getContractVersion()

  const contract = await getReadOnlyGnosisSafeContract(chain, safeVersion)
  // @ts-ignore SwapOwnerTxParams is a union type and the method expects a specific one
  const data = contract.encode('swapOwner', [SENTINEL_ADDRESS, txParams.oldOwnerAddress, txParams.newOwnerAddress])

  const tx = {
    to: await safeSDK.getAddress(),
    value: '0',
    data,
  }

  return safeSDK.createTransaction({
    transactions: [tx],
  })
}

export const createUpdateThresholdTx = async (threshold: number): Promise<SafeTransaction> => {
  const safeSDK = getAndValidateSafeSDK()
  return safeSDK.createChangeThresholdTx(threshold)
}

export const createRemoveModuleTx = async (moduleAddress: string): Promise<SafeTransaction> => {
  const safeSDK = getAndValidateSafeSDK()
  return safeSDK.createDisableModuleTx(moduleAddress)
}

export const createRemoveGuardTx = async (): Promise<SafeTransaction> => {
  const safeSDK = getAndValidateSafeSDK()
  return safeSDK.createDisableGuardTx()
}

/**
 * Create a rejection tx
 */
export const createRejectTx = async (nonce: number): Promise<SafeTransaction> => {
  const safeSDK = getAndValidateSafeSDK()
  return safeSDK.createRejectionTransaction(nonce)
}

/**
 * Prepare a SafeTransaction from Client Gateway / Tx Queue
 */
export const createExistingTx = async (
  chainId: string,
  txId: string,
  txDetails?: TransactionDetails,
): Promise<SafeTransaction> => {
  // Get the tx details from the backend if not provided
  txDetails = txDetails || (await getTransactionDetails(chainId, txId))

  // Convert them to the Core SDK tx params
  const { txParams, signatures } = extractTxInfo(txDetails)

  // Create a tx and add pre-approved signatures
  const safeTx = await createTx(txParams, txParams.nonce)
  Object.entries(signatures).forEach(([signer, data]) => {
    safeTx.addSignature({
      signer,
      data,
      staticPart: () => data,
      dynamicPart: () => '',
      isContractSignature: false,
    })
  })

  return safeTx
}
