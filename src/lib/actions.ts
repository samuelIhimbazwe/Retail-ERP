"use server";

import { callDomain } from "@/lib/api-rpc";

export type { AppNotification, GlobalSearchHit } from "@/lib/domain-actions";

export async function getProducts(...args: Parameters<typeof import("@/lib/domain-actions").getProducts>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").getProducts>>> {
  return (await callDomain("getProducts", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").getProducts>>;
}

export async function getCustomers(...args: Parameters<typeof import("@/lib/domain-actions").getCustomers>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").getCustomers>>> {
  return (await callDomain("getCustomers", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").getCustomers>>;
}

export async function getOpenPurchaseOrders(...args: Parameters<typeof import("@/lib/domain-actions").getOpenPurchaseOrders>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").getOpenPurchaseOrders>>> {
  return (await callDomain("getOpenPurchaseOrders", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").getOpenPurchaseOrders>>;
}

export async function getStockMovements(...args: Parameters<typeof import("@/lib/domain-actions").getStockMovements>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").getStockMovements>>> {
  return (await callDomain("getStockMovements", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").getStockMovements>>;
}

export async function getSessionBusiness(...args: Parameters<typeof import("@/lib/domain-actions").getSessionBusiness>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").getSessionBusiness>>> {
  return (await callDomain("getSessionBusiness", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").getSessionBusiness>>;
}

export async function createSale(...args: Parameters<typeof import("@/lib/domain-actions").createSale>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").createSale>>> {
  return (await callDomain("createSale", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").createSale>>;
}

export async function receivePurchaseOrder(...args: Parameters<typeof import("@/lib/domain-actions").receivePurchaseOrder>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").receivePurchaseOrder>>> {
  return (await callDomain("receivePurchaseOrder", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").receivePurchaseOrder>>;
}

export async function collectCustomerPayment(...args: Parameters<typeof import("@/lib/domain-actions").collectCustomerPayment>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").collectCustomerPayment>>> {
  return (await callDomain("collectCustomerPayment", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").collectCustomerPayment>>;
}

export async function getDebtors(...args: Parameters<typeof import("@/lib/domain-actions").getDebtors>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").getDebtors>>> {
  return (await callDomain("getDebtors", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").getDebtors>>;
}

export async function lookupByBarcode(...args: Parameters<typeof import("@/lib/domain-actions").lookupByBarcode>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").lookupByBarcode>>> {
  return (await callDomain("lookupByBarcode", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").lookupByBarcode>>;
}

export async function getDashboardData(...args: Parameters<typeof import("@/lib/domain-actions").getDashboardData>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").getDashboardData>>> {
  return (await callDomain("getDashboardData", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").getDashboardData>>;
}

export async function getAccountingData(...args: Parameters<typeof import("@/lib/domain-actions").getAccountingData>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").getAccountingData>>> {
  return (await callDomain("getAccountingData", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").getAccountingData>>;
}

export async function createManualJournal(...args: Parameters<typeof import("@/lib/domain-actions").createManualJournal>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").createManualJournal>>> {
  return (await callDomain("createManualJournal", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").createManualJournal>>;
}

export async function getTaxData(...args: Parameters<typeof import("@/lib/domain-actions").getTaxData>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").getTaxData>>> {
  return (await callDomain("getTaxData", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").getTaxData>>;
}

export async function getTaxExportRows(...args: Parameters<typeof import("@/lib/domain-actions").getTaxExportRows>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").getTaxExportRows>>> {
  return (await callDomain("getTaxExportRows", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").getTaxExportRows>>;
}

export async function getBankingData(...args: Parameters<typeof import("@/lib/domain-actions").getBankingData>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").getBankingData>>> {
  return (await callDomain("getBankingData", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").getBankingData>>;
}

export async function transferFunds(...args: Parameters<typeof import("@/lib/domain-actions").transferFunds>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").transferFunds>>> {
  return (await callDomain("transferFunds", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").transferFunds>>;
}

export async function recordCashOut(...args: Parameters<typeof import("@/lib/domain-actions").recordCashOut>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").recordCashOut>>> {
  return (await callDomain("recordCashOut", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").recordCashOut>>;
}

export async function getNotifications(...args: Parameters<typeof import("@/lib/domain-actions").getNotifications>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").getNotifications>>> {
  return (await callDomain("getNotifications", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").getNotifications>>;
}

export async function globalSearch(...args: Parameters<typeof import("@/lib/domain-actions").globalSearch>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").globalSearch>>> {
  return (await callDomain("globalSearch", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").globalSearch>>;
}

export async function getReportsData(...args: Parameters<typeof import("@/lib/domain-actions").getReportsData>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").getReportsData>>> {
  return (await callDomain("getReportsData", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").getReportsData>>;
}

export async function getBranchesData(...args: Parameters<typeof import("@/lib/domain-actions").getBranchesData>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").getBranchesData>>> {
  return (await callDomain("getBranchesData", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").getBranchesData>>;
}

export async function createBranch(...args: Parameters<typeof import("@/lib/domain-actions").createBranch>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").createBranch>>> {
  return (await callDomain("createBranch", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").createBranch>>;
}

export async function updateBranch(...args: Parameters<typeof import("@/lib/domain-actions").updateBranch>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").updateBranch>>> {
  return (await callDomain("updateBranch", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").updateBranch>>;
}

export async function setDefaultBranch(...args: Parameters<typeof import("@/lib/domain-actions").setDefaultBranch>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").setDefaultBranch>>> {
  return (await callDomain("setDefaultBranch", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").setDefaultBranch>>;
}

export async function getWarehouseData(...args: Parameters<typeof import("@/lib/domain-actions").getWarehouseData>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").getWarehouseData>>> {
  return (await callDomain("getWarehouseData", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").getWarehouseData>>;
}

export async function getPurchasingData(...args: Parameters<typeof import("@/lib/domain-actions").getPurchasingData>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").getPurchasingData>>> {
  return (await callDomain("getPurchasingData", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").getPurchasingData>>;
}

export async function getCustomersData(...args: Parameters<typeof import("@/lib/domain-actions").getCustomersData>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").getCustomersData>>> {
  return (await callDomain("getCustomersData", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").getCustomersData>>;
}

export async function getCustomerStatement(...args: Parameters<typeof import("@/lib/domain-actions").getCustomerStatement>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").getCustomerStatement>>> {
  return (await callDomain("getCustomerStatement", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").getCustomerStatement>>;
}

export async function getProcurementData(...args: Parameters<typeof import("@/lib/domain-actions").getProcurementData>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").getProcurementData>>> {
  return (await callDomain("getProcurementData", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").getProcurementData>>;
}

export async function getLoyaltyData(...args: Parameters<typeof import("@/lib/domain-actions").getLoyaltyData>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").getLoyaltyData>>> {
  return (await callDomain("getLoyaltyData", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").getLoyaltyData>>;
}

export async function adjustLoyaltyPoints(...args: Parameters<typeof import("@/lib/domain-actions").adjustLoyaltyPoints>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").adjustLoyaltyPoints>>> {
  return (await callDomain("adjustLoyaltyPoints", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").adjustLoyaltyPoints>>;
}

export async function redeemLoyaltyPoints(...args: Parameters<typeof import("@/lib/domain-actions").redeemLoyaltyPoints>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").redeemLoyaltyPoints>>> {
  return (await callDomain("redeemLoyaltyPoints", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").redeemLoyaltyPoints>>;
}

export async function getBiData(...args: Parameters<typeof import("@/lib/domain-actions").getBiData>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").getBiData>>> {
  return (await callDomain("getBiData", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").getBiData>>;
}

export async function getSecurityData(...args: Parameters<typeof import("@/lib/domain-actions").getSecurityData>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").getSecurityData>>> {
  return (await callDomain("getSecurityData", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").getSecurityData>>;
}

export async function createSecurityUser(...args: Parameters<typeof import("@/lib/domain-actions").createSecurityUser>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").createSecurityUser>>> {
  return (await callDomain("createSecurityUser", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").createSecurityUser>>;
}

export async function updateSecurityUser(...args: Parameters<typeof import("@/lib/domain-actions").updateSecurityUser>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").updateSecurityUser>>> {
  return (await callDomain("updateSecurityUser", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").updateSecurityUser>>;
}

export async function resetSecurityUserPassword(...args: Parameters<typeof import("@/lib/domain-actions").resetSecurityUserPassword>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").resetSecurityUserPassword>>> {
  return (await callDomain("resetSecurityUserPassword", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").resetSecurityUserPassword>>;
}

export async function createPasswordResetLink(...args: Parameters<typeof import("@/lib/domain-actions").createPasswordResetLink>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").createPasswordResetLink>>> {
  return (await callDomain("createPasswordResetLink", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").createPasswordResetLink>>;
}

export async function getPasswordResetPreview(...args: Parameters<typeof import("@/lib/domain-actions").getPasswordResetPreview>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").getPasswordResetPreview>>> {
  return (await callDomain("getPasswordResetPreview", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").getPasswordResetPreview>>;
}

export async function acceptPasswordReset(...args: Parameters<typeof import("@/lib/domain-actions").acceptPasswordReset>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").acceptPasswordReset>>> {
  return (await callDomain("acceptPasswordReset", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").acceptPasswordReset>>;
}

export async function createUserInvite(...args: Parameters<typeof import("@/lib/domain-actions").createUserInvite>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").createUserInvite>>> {
  return (await callDomain("createUserInvite", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").createUserInvite>>;
}

export async function revokeUserInvite(...args: Parameters<typeof import("@/lib/domain-actions").revokeUserInvite>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").revokeUserInvite>>> {
  return (await callDomain("revokeUserInvite", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").revokeUserInvite>>;
}

export async function getInvitePreview(...args: Parameters<typeof import("@/lib/domain-actions").getInvitePreview>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").getInvitePreview>>> {
  return (await callDomain("getInvitePreview", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").getInvitePreview>>;
}

export async function acceptUserInvite(...args: Parameters<typeof import("@/lib/domain-actions").acceptUserInvite>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").acceptUserInvite>>> {
  return (await callDomain("acceptUserInvite", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").acceptUserInvite>>;
}

export async function getUsersManagementData(...args: Parameters<typeof import("@/lib/domain-actions").getUsersManagementData>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").getUsersManagementData>>> {
  return (await callDomain("getUsersManagementData", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").getUsersManagementData>>;
}

export async function getSettingsData(...args: Parameters<typeof import("@/lib/domain-actions").getSettingsData>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").getSettingsData>>> {
  return (await callDomain("getSettingsData", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").getSettingsData>>;
}

export async function updateBusinessSettings(...args: Parameters<typeof import("@/lib/domain-actions").updateBusinessSettings>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").updateBusinessSettings>>> {
  return (await callDomain("updateBusinessSettings", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").updateBusinessSettings>>;
}

export async function changeOwnPassword(...args: Parameters<typeof import("@/lib/domain-actions").changeOwnPassword>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").changeOwnPassword>>> {
  return (await callDomain("changeOwnPassword", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").changeOwnPassword>>;
}

export async function updateOwnProfile(...args: Parameters<typeof import("@/lib/domain-actions").updateOwnProfile>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").updateOwnProfile>>> {
  return (await callDomain("updateOwnProfile", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").updateOwnProfile>>;
}

export async function getPayrollData(...args: Parameters<typeof import("@/lib/domain-actions").getPayrollData>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").getPayrollData>>> {
  return (await callDomain("getPayrollData", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").getPayrollData>>;
}

export async function updateStaffSalary(...args: Parameters<typeof import("@/lib/domain-actions").updateStaffSalary>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").updateStaffSalary>>> {
  return (await callDomain("updateStaffSalary", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").updateStaffSalary>>;
}

export async function runPayroll(...args: Parameters<typeof import("@/lib/domain-actions").runPayroll>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").runPayroll>>> {
  return (await callDomain("runPayroll", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").runPayroll>>;
}

export async function getIntegrationsData(...args: Parameters<typeof import("@/lib/domain-actions").getIntegrationsData>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").getIntegrationsData>>> {
  return (await callDomain("getIntegrationsData", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").getIntegrationsData>>;
}

export async function getAiContext(...args: Parameters<typeof import("@/lib/domain-actions").getAiContext>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").getAiContext>>> {
  return (await callDomain("getAiContext", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").getAiContext>>;
}

export async function createCustomer(...args: Parameters<typeof import("@/lib/domain-actions").createCustomer>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").createCustomer>>> {
  return (await callDomain("createCustomer", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").createCustomer>>;
}

export async function updateCustomer(...args: Parameters<typeof import("@/lib/domain-actions").updateCustomer>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").updateCustomer>>> {
  return (await callDomain("updateCustomer", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").updateCustomer>>;
}

export async function generateReorderPurchaseOrders(...args: Parameters<typeof import("@/lib/domain-actions").generateReorderPurchaseOrders>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").generateReorderPurchaseOrders>>> {
  return (await callDomain("generateReorderPurchaseOrders", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").generateReorderPurchaseOrders>>;
}

export async function getPurchasingFormOptions(...args: Parameters<typeof import("@/lib/domain-actions").getPurchasingFormOptions>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").getPurchasingFormOptions>>> {
  return (await callDomain("getPurchasingFormOptions", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").getPurchasingFormOptions>>;
}

export async function createPurchaseOrder(...args: Parameters<typeof import("@/lib/domain-actions").createPurchaseOrder>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").createPurchaseOrder>>> {
  return (await callDomain("createPurchaseOrder", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").createPurchaseOrder>>;
}

export async function createSupplier(...args: Parameters<typeof import("@/lib/domain-actions").createSupplier>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").createSupplier>>> {
  return (await callDomain("createSupplier", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").createSupplier>>;
}

export async function updateSupplier(...args: Parameters<typeof import("@/lib/domain-actions").updateSupplier>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").updateSupplier>>> {
  return (await callDomain("updateSupplier", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").updateSupplier>>;
}

export async function paySupplier(...args: Parameters<typeof import("@/lib/domain-actions").paySupplier>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").paySupplier>>> {
  return (await callDomain("paySupplier", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").paySupplier>>;
}

export async function approvePurchaseOrder(...args: Parameters<typeof import("@/lib/domain-actions").approvePurchaseOrder>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").approvePurchaseOrder>>> {
  return (await callDomain("approvePurchaseOrder", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").approvePurchaseOrder>>;
}

export async function cancelPurchaseOrder(...args: Parameters<typeof import("@/lib/domain-actions").cancelPurchaseOrder>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").cancelPurchaseOrder>>> {
  return (await callDomain("cancelPurchaseOrder", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").cancelPurchaseOrder>>;
}

export async function getSalesExportRows(...args: Parameters<typeof import("@/lib/domain-actions").getSalesExportRows>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").getSalesExportRows>>> {
  return (await callDomain("getSalesExportRows", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").getSalesExportRows>>;
}

export async function getInventoryExportRows(...args: Parameters<typeof import("@/lib/domain-actions").getInventoryExportRows>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").getInventoryExportRows>>> {
  return (await callDomain("getInventoryExportRows", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").getInventoryExportRows>>;
}

export async function createProduct(...args: Parameters<typeof import("@/lib/domain-actions").createProduct>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").createProduct>>> {
  return (await callDomain("createProduct", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").createProduct>>;
}

export async function updateProduct(...args: Parameters<typeof import("@/lib/domain-actions").updateProduct>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").updateProduct>>> {
  return (await callDomain("updateProduct", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").updateProduct>>;
}

export async function adjustStock(...args: Parameters<typeof import("@/lib/domain-actions").adjustStock>): Promise<Awaited<ReturnType<typeof import("@/lib/domain-actions").adjustStock>>> {
  return (await callDomain("adjustStock", args)) as Awaited<ReturnType<typeof import("@/lib/domain-actions").adjustStock>>;
}
