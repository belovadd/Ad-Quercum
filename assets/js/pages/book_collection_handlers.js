/**
 *  СТРАНИЦА: Произведение — модалка выбора коллекций для издания 
 *
 * НАЗНАЧЕНИЕ:
 *   Изолирует логику кнопки «В коллекцию»: загрузка коллекций с флагами,
 *   рендер чекбоксов и синхронизация выбранных коллекций для конкретного
 *   edition_id. Общая полка остаётся отдельным действием «На полку».
 */

(function () {
'use strict';

async function openBookCollectionPicker(options) {
    const opts = options || {};
    const editionId = opts.getEditionId ? opts.getEditionId(opts.edition) : null;

    if (!editionId) {
        Notification.error('Не удалось определить издание');
        return;
    }

    let collections = [];
    try {
        collections = await LibraryService.getEditionCollections(editionId);
    } catch (error) {
        Notification.error(error.message || 'Не удалось загрузить коллекции');
        return;
    }

    if (!collections.length) {
        Notification.info('Сначала создайте коллекцию на странице «Коллекции»');
        return;
    }

    const picker = buildCollectionPicker(collections);
    opts.openModal('Добавить в коллекцию', picker.element, async function () {
        await syncEditionCollections(
            editionId,
            picker.getSelectedIds(),
            picker.getInitialIds(),
            opts.runAction,
            opts.reload
        );
        return true;
    });
}

function buildCollectionPicker(collections) {
    const form = document.createElement('div');
    form.className = 'collection-picker';

    const note = document.createElement('p');
    note.className = 'muted-text';
    note.textContent = 'Выберите одну или несколько коллекций. Если снять все галочки, издание останется на общей полке без коллекций.';
    form.appendChild(note);

    const list = document.createElement('div');
    list.className = 'collection-picker-list';
    form.appendChild(list);

    const initialIds = collections
        .filter(function (library) { return Number(library.is_selected) === 1; })
        .map(function (library) { return Number(library.id); });

    collections.forEach(function (library) {
        list.appendChild(buildCollectionPickerOption(library));
    });

    return {
        element: form,
        getSelectedIds: function () {
            return Array.from(form.querySelectorAll('input[type="checkbox"]:checked'))
                .map(function (input) { return Number(input.value); })
                .filter(function (id) { return id > 0; });
        },
        getInitialIds: function () {
            return initialIds.slice();
        },
    };
}

function buildCollectionPickerOption(library) {
    const label = document.createElement('label');
    label.className = 'form-toggle';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = String(library.id);
    input.checked = Number(library.is_selected) === 1;
    label.appendChild(input);

    const track = document.createElement('span');
    track.className = 'form-toggle-track';
    const dot = document.createElement('span');
    dot.className = 'form-toggle-dot';
    track.appendChild(dot);
    label.appendChild(track);

    const textBlock = document.createElement('span');
    textBlock.className = 'form-toggle-label';
    textBlock.textContent = Utils.safeText(library.library_name, 'Без названия');
    label.appendChild(textBlock);

    return label;
}

async function syncEditionCollections(editionId, selectedIds, initialIds, runAction, reload) {
    const selectedSet = new Set(selectedIds);
    const initialSet = new Set(initialIds);

    const toAdd = selectedIds.filter(function (libraryId) {
        return !initialSet.has(libraryId);
    });
    const toRemove = initialIds.filter(function (libraryId) {
        return !selectedSet.has(libraryId);
    });

    await runAction('sync-collections:' + editionId, async function () {
        try {
            await Promise.all(toRemove.map(function (libraryId) {
                return LibraryService.removeEdition(libraryId, editionId);
            }));
            await Promise.all(toAdd.map(function (libraryId) {
                return LibraryService.addEdition(libraryId, editionId);
            }));

            Notification.success(
                selectedIds.length > 0
                    ? 'Коллекции обновлены'
                    : 'Издание не добавлено ни в одну коллекцию'
            );
            await reload();
        } catch (error) {
            Notification.error(error.message || 'Не удалось обновить коллекции');
            throw error;
        }
    });
}

window.openBookCollectionPicker = openBookCollectionPicker;
})();
