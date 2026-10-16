import { useCallback } from 'react';
import toast from 'react-hot-toast';
import { warningIcon } from '../utils/toastIcons';
import {
  bulkAssignSelectedAssets, bulkReturnAssets, bulkUpdateAssets, exportAssetsExcel,
} from '../api/assetsApi';
import { returnSummary } from '../utils/assetSelection';
import { blobErrorMessage, downloadBlob, exportFilename } from '../utils/download';

const messageOf = (err, fallback) => err?.response?.data?.message || fallback;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Inventory bulk actions on selected asset ids. Each toasts its own result
 * and resolves to the server's answer (or throws after the error toast).
 * Changed lists reload on their own: every successful POST invalidates the
 * cached asset lists (see utils/queryCache).
 */
export default function useBulkAssetActions() {
  const assign = useCallback(async (assetIds, employeeId, note, employeeName) => {
    try {
      const res = await bulkAssignSelectedAssets(assetIds, employeeId, note);
      const assigned = res.data?.data?.assigned ?? assetIds.length;
      toast.success(`Assigned ${plural(assigned, 'asset')}${employeeName ? ` to ${employeeName}` : ''}`);
      return res.data?.data;
    } catch (err) {
      toast.error(messageOf(err, 'Could not assign the selected assets'));
      throw err;
    }
  }, []);

  const returnAssets = useCallback(async (assetIds, note) => {
    try {
      const res = await bulkReturnAssets(assetIds, note);
      const data = res.data?.data || {};
      const skipped = Array.isArray(data.skipped) ? data.skipped : [];
      const text = returnSummary({ returned: data.returned ?? 0, skipped });
      if (skipped.length) toast(text, { icon: warningIcon(), duration: 8000 });
      else toast.success(text);
      return data;
    } catch (err) {
      toast.error(messageOf(err, 'Could not return the selected assets'));
      throw err;
    }
  }, []);

  const update = useCallback(async (assetIds, changes) => {
    try {
      const res = await bulkUpdateAssets(assetIds, changes);
      const updated = res.data?.data?.updated ?? assetIds.length;
      toast.success(`Updated ${plural(updated, 'asset')}`);
      return res.data?.data;
    } catch (err) {
      toast.error(messageOf(err, 'Could not update the selected assets'));
      throw err;
    }
  }, []);

  const exportSelected = useCallback(async (assetIds) => {
    try {
      const res = await exportAssetsExcel(assetIds);
      downloadBlob(res.data, exportFilename(`${assetIds.length}-selected`));
      toast.success(`Exported ${plural(assetIds.length, 'asset')}`);
    } catch (err) {
      toast.error(await blobErrorMessage(err, 'Export failed'));
      throw err;
    }
  }, []);

  return { assign, returnAssets, update, exportSelected };
}
