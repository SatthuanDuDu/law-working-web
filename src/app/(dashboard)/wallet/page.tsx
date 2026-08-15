import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import { WalletView } from "@/components/wallet/wallet-view";
import { requireAuth } from "@/lib/session";
import { ensureStaffWallet } from "@/lib/wallet";
import { prisma } from "@/lib/prisma";
import { listWalletTransactionsAction } from "@/lib/wallet-actions";
import { listMoneyConfirmationsAction } from "@/lib/money-confirmation-actions";
import { listPackagesAction } from "@/lib/budget-package-actions";
import { packageRemainingVnd } from "@/lib/budget-package";
import { getTranslations } from "next-intl/server";

export default async function WalletPage() {
  const user = await requireAuth();
  const tPages = await getTranslations("pages.wallet");
  const wallet = await ensureStaffWallet(prisma, user.id);
  const [{ transactions }, { confirmations }, packagesRes, clientCashAgg] =
    await Promise.all([
      listWalletTransactionsAction({
        scope: "mine",
        includeLegacy: true,
        take: 200,
      }),
      listMoneyConfirmationsAction({ scope: "mine", status: "OPEN", take: 40 }),
      listPackagesAction({ status: "ACTIVE", take: 50 }),
      prisma.walletTransaction.aggregate({
        where: {
          walletUserId: user.id,
          direction: "CREDIT",
          kind: "CLIENT_RECEIPT",
          legacyImported: false,
        },
        _sum: { amountVnd: true },
      }),
    ]);

  const packages = packagesRes.packages ?? [];
  const packageRemainingSum = packages.reduce(
    (acc, p) =>
      acc +
      packageRemainingVnd({
        allocatedVnd: BigInt(p.allocatedVnd),
        spentVnd: BigInt(p.spentVnd),
        returnedVnd: BigInt(p.returnedVnd),
      }),
    BigInt(0),
  );

  return (
    <div className="space-y-4">
      <PageHeaderSlot title={tPages("title")} />
      <WalletView
        balanceVnd={wallet.balanceVnd.toString()}
        packageRemainingSumVnd={packageRemainingSum.toString()}
        clientCashHeldVnd={(clientCashAgg._sum.amountVnd ?? BigInt(0)).toString()}
        packages={packages}
        initialTransactions={transactions}
        confirmations={confirmations}
      />
    </div>
  );
}
