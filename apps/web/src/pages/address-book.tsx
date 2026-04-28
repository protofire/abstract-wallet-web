import type { NextPage } from 'next'
import Head from 'next/head'
import AddressBookTable from '@/components/address-book/AddressBookTable'
import { AddressBookSourceProvider } from '@/components/common/AddressBookSourceProvider'

const AddressBook: NextPage = () => {
  return (
    <>
      <Head>
        <title>Abstract Safe Wallet – Address book</title>
      </Head>

      <AddressBookSourceProvider source="localOnly">
        <AddressBookTable />
      </AddressBookSourceProvider>
    </>
  )
}

export default AddressBook
