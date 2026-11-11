package com.glueck.app;

import android.Manifest;
import android.content.ContentProviderOperation;
import android.content.ContentResolver;
import android.content.Intent;
import android.content.OperationApplicationException;
import android.database.Cursor;
import android.net.Uri;
import android.os.RemoteException;
import android.provider.BaseColumns;
import android.provider.ContactsContract;
import android.provider.ContactsContract.CommonDataKinds.Note;
import android.provider.ContactsContract.CommonDataKinds.Phone;
import android.provider.ContactsContract.CommonDataKinds.StructuredName;
import android.provider.ContactsContract.Data;
import android.provider.ContactsContract.RawContacts;
import android.provider.Settings;
import android.util.Log;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

@CapacitorPlugin(
    name = "ContactsManager",
    permissions = {
        @Permission(
            alias = "contacts",
            strings = {
                Manifest.permission.READ_CONTACTS,
                Manifest.permission.WRITE_CONTACTS
            }
        )
    }
)
public class ContactsManagerPlugin extends Plugin {
    private static final String TAG = "ContactsManagerPlugin";

    /**
     * Opens system app settings for permission management.
     */
    @PluginMethod
    public void openSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.fromParts("package", getContext().getPackageName(), null));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("opened", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to open app settings", e);
            call.reject("Cannot open app settings: " + e.getMessage());
        }
    }

    /**
     * Reads all device contacts with phone numbers, account info, and notes.
     */
    @PluginMethod
    public void getContacts(PluginCall call) {
        try {
            ContentResolver resolver = getContext().getContentResolver();
            JSArray contactsArray = new JSArray();

            // Map: contactId -> Contact Builder
            Map<String, JSObject> contactMap = new HashMap<>();
            Map<String, Set<String>> phoneSets = new HashMap<>();
            Map<String, JSArray> phoneArrays = new HashMap<>();

            // 1. Query Phones joined with Contacts
            Uri phoneUri = Phone.CONTENT_URI;
            String[] phoneProjection = new String[] {
                Phone.CONTACT_ID,
                Phone.RAW_CONTACT_ID,
                Phone.DISPLAY_NAME,
                Phone.NUMBER,
                Phone.NORMALIZED_NUMBER,
                Phone.TYPE
            };

            try (Cursor cursor = resolver.query(phoneUri, phoneProjection, null, null, Phone.DISPLAY_NAME + " ASC")) {
                if (cursor != null) {
                    int idIdx = cursor.getColumnIndex(Phone.CONTACT_ID);
                    int rawIdIdx = cursor.getColumnIndex(Phone.RAW_CONTACT_ID);
                    int nameIdx = cursor.getColumnIndex(Phone.DISPLAY_NAME);
                    int numIdx = cursor.getColumnIndex(Phone.NUMBER);
                    int normIdx = cursor.getColumnIndex(Phone.NORMALIZED_NUMBER);

                    while (cursor.moveToNext()) {
                        String contactId = cursor.getString(idIdx);
                        if (contactId == null) continue;

                        String rawId = cursor.getString(rawIdIdx);
                        String name = cursor.getString(nameIdx);
                        String number = cursor.getString(numIdx);
                        String norm = cursor.getString(normIdx);

                        if (number == null || number.trim().isEmpty()) continue;

                        JSObject contactObj = contactMap.get(contactId);
                        if (contactObj == null) {
                            contactObj = new JSObject();
                            contactObj.put("id", contactId);
                            contactObj.put("rawContactId", rawId);
                            contactObj.put("displayName", name != null ? name : "");
                            JSArray phoneArr = new JSArray();
                            contactObj.put("phoneNumbers", phoneArr);
                            contactObj.put("isGoogleAccount", false);
                            contactObj.put("isReadOnly", false);
                            contactMap.put(contactId, contactObj);
                            phoneSets.put(contactId, new HashSet<>());
                            phoneArrays.put(contactId, phoneArr);
                        }

                        Set<String> set = phoneSets.get(contactId);
                        if (set != null && !set.contains(number.trim())) {
                            set.add(number.trim());
                            JSObject phoneObj = new JSObject();
                            phoneObj.put("number", number);
                            phoneObj.put("normalizedNumber", norm != null ? norm : "");
                            
                            JSArray arr = phoneArrays.get(contactId);
                            if (arr != null) {
                                arr.put(phoneObj);
                            }
                        }
                    }
                }
            }

            // 2. Query RawContacts to determine account types (Google sync, device, read-only)
            try {
                Uri rawUri = RawContacts.CONTENT_URI;
                String[] rawProjection = new String[] {
                    RawContacts.CONTACT_ID,
                    BaseColumns._ID,
                    RawContacts.ACCOUNT_TYPE,
                    RawContacts.ACCOUNT_NAME
                };

                try (Cursor rawCursor = resolver.query(rawUri, rawProjection, null, null, null)) {
                    if (rawCursor != null) {
                        int cIdIdx = rawCursor.getColumnIndex(RawContacts.CONTACT_ID);
                        int accTypeIdx = rawCursor.getColumnIndex(RawContacts.ACCOUNT_TYPE);
                        int accNameIdx = rawCursor.getColumnIndex(RawContacts.ACCOUNT_NAME);

                        while (rawCursor.moveToNext()) {
                            String cId = rawCursor.getString(cIdIdx);
                            if (cId != null && contactMap.containsKey(cId)) {
                                JSObject obj = contactMap.get(cId);
                                String accType = rawCursor.getString(accTypeIdx);
                                String accName = rawCursor.getString(accNameIdx);

                                if (accType != null) {
                                    obj.put("accountType", accType);
                                    if (accType.toLowerCase().contains("google")) {
                                        obj.put("isGoogleAccount", true);
                                    }
                                }
                                if (accName != null) {
                                    obj.put("accountName", accName);
                                }
                            }
                        }
                    }
                }
            } catch (Exception e) {
                Log.w(TAG, "Failed to query raw contacts accounts info", e);
            }

            // 3. Assemble final result array
            for (JSObject obj : contactMap.values()) {
                contactsArray.put(obj);
            }

            JSObject result = new JSObject();
            result.put("contacts", contactsArray);
            result.put("total", contactsArray.length());
            call.resolve(result);

        } catch (Exception e) {
            Log.e(TAG, "Error fetching contacts", e);
            call.reject("Failed to retrieve contacts: " + e.getMessage());
        }
    }

    /**
     * Atomically updates a contact's display name and optional note.
     */
    @PluginMethod
    public void updateContactName(PluginCall call) {
        String contactId = call.getString("contactId");
        String newDisplayName = call.getString("newDisplayName");
        String note = call.getString("note");

        if (contactId == null || newDisplayName == null || newDisplayName.trim().isEmpty()) {
            call.reject("Missing required parameters: contactId or newDisplayName");
            return;
        }

        try {
            boolean success = applyContactNameUpdate(contactId, newDisplayName.trim(), note);
            if (success) {
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("contactId", contactId);
                ret.put("updatedName", newDisplayName.trim());
                call.resolve(ret);
            } else {
                call.reject("Failed to apply update to contact " + contactId);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error updating contact name", e);
            call.reject("Exception updating contact: " + e.getMessage());
        }
    }

    /**
     * Batch updates multiple contacts atomically with isolated failure protection.
     */
    @PluginMethod
    public void batchUpdateContacts(PluginCall call) {
        JSArray updates = call.getArray("updates");
        if (updates == null || updates.length() == 0) {
            JSObject emptyRes = new JSObject();
            emptyRes.put("updatedCount", 0);
            emptyRes.put("failedCount", 0);
            emptyRes.put("errors", new JSArray());
            call.resolve(emptyRes);
            return;
        }

        int updatedCount = 0;
        int failedCount = 0;
        JSArray errors = new JSArray();

        for (int i = 0; i < updates.length(); i++) {
            try {
                JSONObject item = updates.getJSONObject(i);
                String contactId = item.getString("contactId");
                String newDisplayName = item.getString("newDisplayName");
                String note = item.has("note") ? item.getString("note") : null;

                boolean ok = applyContactNameUpdate(contactId, newDisplayName, note);
                if (ok) {
                    updatedCount++;
                } else {
                    failedCount++;
                    errors.put("Could not update contact ID: " + contactId);
                }
            } catch (Exception e) {
                failedCount++;
                errors.put(e.getMessage());
                Log.e(TAG, "Error in batch item " + i, e);
            }
        }

        JSObject result = new JSObject();
        result.put("updatedCount", updatedCount);
        result.put("failedCount", failedCount);
        result.put("errors", errors);
        call.resolve(result);
    }

    private boolean applyContactNameUpdate(String contactId, String newDisplayName, String note) 
            throws RemoteException, OperationApplicationException {
        ContentResolver resolver = getContext().getContentResolver();
        ArrayList<ContentProviderOperation> ops = new ArrayList<>();

        // 1. Update StructuredName
        String nameWhere = Data.CONTACT_ID + " = ? AND " + Data.MIMETYPE + " = ?";
        String[] nameArgs = new String[] {
            contactId,
            StructuredName.CONTENT_ITEM_TYPE
        };

        ops.add(ContentProviderOperation.newUpdate(Data.CONTENT_URI)
            .withSelection(nameWhere, nameArgs)
            .withValue(StructuredName.DISPLAY_NAME, newDisplayName)
            .withValue(StructuredName.GIVEN_NAME, newDisplayName)
            .withValue(StructuredName.FAMILY_NAME, "")
            .build());

        // 2. Update Note if provided
        if (note != null && !note.trim().isEmpty()) {
            String noteWhere = Data.CONTACT_ID + " = ? AND " + Data.MIMETYPE + " = ?";
            String[] noteArgs = new String[] {
                contactId,
                Note.CONTENT_ITEM_TYPE
            };

            // Check if note exists
            boolean noteExists = false;
            try (Cursor c = resolver.query(Data.CONTENT_URI, new String[] { BaseColumns._ID }, noteWhere, noteArgs, null)) {
                if (c != null && c.moveToFirst()) {
                    noteExists = true;
                }
            }

            if (noteExists) {
                ops.add(ContentProviderOperation.newUpdate(Data.CONTENT_URI)
                    .withSelection(noteWhere, noteArgs)
                    .withValue(Note.NOTE, note.trim())
                    .build());
            } else {
                // Find a valid RAW_CONTACT_ID
                String rawContactId = getRawContactIdForContact(contactId);
                if (rawContactId != null) {
                    try {
                        long rawIdLong = Long.parseLong(rawContactId);
                        ops.add(ContentProviderOperation.newInsert(Data.CONTENT_URI)
                            .withValue(Data.RAW_CONTACT_ID, rawIdLong)
                            .withValue(Data.MIMETYPE, Note.CONTENT_ITEM_TYPE)
                            .withValue(Note.NOTE, note.trim())
                            .build());
                    } catch (NumberFormatException ignored) {}
                }
            }
        }

        resolver.applyBatch(ContactsContract.AUTHORITY, ops);
        return true;
    }

    /**
     * Creates a new contact in phone storage atomically.
     */
    @PluginMethod
    public void createContact(PluginCall call) {
        String displayName = call.getString("displayName");
        String phoneNumber = call.getString("phoneNumber");
        String note = call.getString("note");

        if (displayName == null || displayName.trim().isEmpty() || phoneNumber == null || phoneNumber.trim().isEmpty()) {
            call.reject("Missing required parameters: displayName or phoneNumber");
            return;
        }

        try {
            boolean success = applyContactCreation(displayName.trim(), phoneNumber.trim(), note);
            if (success) {
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("displayName", displayName.trim());
                ret.put("phoneNumber", phoneNumber.trim());
                call.resolve(ret);
            } else {
                call.reject("Failed to create contact");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error creating contact", e);
            call.reject("Exception creating contact: " + e.getMessage());
        }
    }

    /**
     * Batch creates multiple new contacts atomically.
     */
    @PluginMethod
    public void batchCreateContacts(PluginCall call) {
        JSArray contacts = call.getArray("contacts");
        if (contacts == null || contacts.length() == 0) {
            JSObject emptyRes = new JSObject();
            emptyRes.put("createdCount", 0);
            emptyRes.put("failedCount", 0);
            emptyRes.put("errors", new JSArray());
            call.resolve(emptyRes);
            return;
        }

        int createdCount = 0;
        int failedCount = 0;
        JSArray errors = new JSArray();

        for (int i = 0; i < contacts.length(); i++) {
            try {
                JSONObject item = contacts.getJSONObject(i);
                String displayName = item.getString("displayName");
                String phoneNumber = item.getString("phoneNumber");
                String note = item.has("note") ? item.getString("note") : null;

                boolean ok = applyContactCreation(displayName.trim(), phoneNumber.trim(), note);
                if (ok) {
                    createdCount++;
                } else {
                    failedCount++;
                    errors.put("Could not create contact: " + displayName);
                }
            } catch (Exception e) {
                failedCount++;
                errors.put(e.getMessage());
                Log.e(TAG, "Error in batch contact creation item " + i, e);
            }
        }

        JSObject result = new JSObject();
        result.put("createdCount", createdCount);
        result.put("failedCount", failedCount);
        result.put("errors", errors);
        call.resolve(result);
    }

    /**
     * Opens system Contacts insert screen pre-populated with details.
     */
    @PluginMethod
    public void openContactEditor(PluginCall call) {
        String displayName = call.getString("displayName");
        String phoneNumber = call.getString("phoneNumber");
        String note = call.getString("note");

        try {
            Intent intent = new Intent(Intent.ACTION_INSERT);
            intent.setType(ContactsContract.Contacts.CONTENT_TYPE);
            if (displayName != null && !displayName.trim().isEmpty()) {
                intent.putExtra(ContactsContract.Intents.Insert.NAME, displayName.trim());
            }
            if (phoneNumber != null && !phoneNumber.trim().isEmpty()) {
                intent.putExtra(ContactsContract.Intents.Insert.PHONE, phoneNumber.trim());
            }
            if (note != null && !note.trim().isEmpty()) {
                intent.putExtra(ContactsContract.Intents.Insert.NOTES, note.trim());
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("opened", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to open contact editor", e);
            call.reject("Cannot open contact editor: " + e.getMessage());
        }
    }

    private boolean applyContactCreation(String displayName, String phoneNumber, String note)
            throws RemoteException, OperationApplicationException {
        ContentResolver resolver = getContext().getContentResolver();
        ArrayList<ContentProviderOperation> ops = new ArrayList<>();
        int rawContactInsertIndex = ops.size();

        ops.add(ContentProviderOperation.newInsert(RawContacts.CONTENT_URI)
            .withValue(RawContacts.ACCOUNT_TYPE, null)
            .withValue(RawContacts.ACCOUNT_NAME, null)
            .build());

        // Structured Name
        ops.add(ContentProviderOperation.newInsert(Data.CONTENT_URI)
            .withValueBackReference(Data.RAW_CONTACT_ID, rawContactInsertIndex)
            .withValue(Data.MIMETYPE, StructuredName.CONTENT_ITEM_TYPE)
            .withValue(StructuredName.DISPLAY_NAME, displayName)
            .withValue(StructuredName.GIVEN_NAME, displayName)
            .build());

        // Phone Number
        ops.add(ContentProviderOperation.newInsert(Data.CONTENT_URI)
            .withValueBackReference(Data.RAW_CONTACT_ID, rawContactInsertIndex)
            .withValue(Data.MIMETYPE, Phone.CONTENT_ITEM_TYPE)
            .withValue(Phone.NUMBER, phoneNumber)
            .withValue(Phone.TYPE, Phone.TYPE_MOBILE)
            .build());

        // Note
        if (note != null && !note.trim().isEmpty()) {
            ops.add(ContentProviderOperation.newInsert(Data.CONTENT_URI)
                .withValueBackReference(Data.RAW_CONTACT_ID, rawContactInsertIndex)
                .withValue(Data.MIMETYPE, Note.CONTENT_ITEM_TYPE)
                .withValue(Note.NOTE, note.trim())
                .build());
        }

        resolver.applyBatch(ContactsContract.AUTHORITY, ops);
        return true;
    }

    private String getRawContactIdForContact(String contactId) {
        ContentResolver resolver = getContext().getContentResolver();
        String selection = RawContacts.CONTACT_ID + " = ? AND " + RawContacts.DELETED + " = 0";
        String[] args = new String[] { contactId };
        
        try (Cursor c = resolver.query(RawContacts.CONTENT_URI, new String[] { BaseColumns._ID }, selection, args, null)) {
            if (c != null && c.moveToFirst()) {
                return c.getString(0);
            }
        } catch (Exception ignored) {}
        return null;
    }
}
