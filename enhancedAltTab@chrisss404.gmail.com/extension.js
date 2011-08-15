const AltTab = imports.ui.altTab;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;

const Main = imports.ui.main;

function main(metadata) {
    Main._isAltTabPopupVisible = function() {
        for(let i = 0; i < Main.uiGroup.get_n_children(); i++) {
            if(Main.uiGroup.get_nth_child(i).get_name() == "altTabPopup") {
                return Main.uiGroup.get_nth_child(i).visible;
            }
        }
        return false;
    };

    Main._checkWorkspaces = function() {
        let i;
        let emptyWorkspaces = new Array(Main._workspaces.length);

        for (i = 0; i < Main._workspaces.length; i++) {
            let lastRemoved = Main._workspaces[i]._lastRemovedWindow;
            if (lastRemoved &&
                (lastRemoved.get_window_type() == Meta.WindowType.SPLASHSCREEN ||
                 lastRemoved.get_window_type() == Meta.WindowType.DIALOG ||
                 lastRemoved.get_window_type() == Meta.WindowType.MODAL_DIALOG))
                    emptyWorkspaces[i] = false;
            else
                emptyWorkspaces[i] = true;
        }

        let windows = global.get_window_actors();
        for (i = 0; i < windows.length; i++) {
            let win = windows[i];

            if (win.get_meta_window().is_on_all_workspaces())
                continue;

            let workspaceIndex = win.get_workspace();
            emptyWorkspaces[workspaceIndex] = false;
        }

        // If we don't have an empty workspace at the end, add one
        if (!emptyWorkspaces[emptyWorkspaces.length -1]) {
            global.screen.append_new_workspace(false, global.get_current_time());
            emptyWorkspaces.push(false);
        }

        let activeWorkspaceIndex = global.screen.get_active_workspace_index();
        let activeIsLast = activeWorkspaceIndex == global.screen.n_workspaces - 2;
        let removingTrailWorkspaces = (emptyWorkspaces[activeWorkspaceIndex] &&
                                        activeIsLast);
        // Don't enter the overview when removing multiple empty workspaces at startup
        let showOverview  = (removingTrailWorkspaces &&
                             !emptyWorkspaces.every(function(x) { return x; }));

        if (removingTrailWorkspaces) {
            // "Merge" the empty workspace we are removing with the one at the end
            Main.wm.blockAnimations();
        }

        // Delete other empty workspaces; do it from the end to avoid index changes
        for (i = emptyWorkspaces.length - 2; i >= 0; i--) {
            if (emptyWorkspaces[i])
                global.screen.remove_workspace(Main._workspaces[i], global.get_current_time());
            else
                break;
        }

        if (removingTrailWorkspaces) {
            global.screen.get_workspace_by_index(global.screen.n_workspaces - 1).activate(global.get_current_time());

            Main.wm.unblockAnimations();

            if (!Main.overview.visible && !Main._isAltTabPopupVisible() && showOverview)
                Main.overview.show();
        }

        Main._checkWorkspacesId = 0;
        return false;
    };

    AltTab.AltTabPopup.prototype._removeAppSeperator = function(apps) {
        if(this._appSwitcher._separator == null) return;

        let activeWorkspace = global.screen.get_active_workspace();
        let owenWorkspace = 0;
        let otherWorkspace = 0;

        for(let i = 0; i < apps.length; i++) {
            let windowIsOnActiveWorkspace = false;
            for(let j = 0; j < apps[i]['cachedWindows'].length; j++) {
                if(apps[i]['cachedWindows'][j].get_workspace() == activeWorkspace) {
                    windowIsOnActiveWorkspace = true;
                }
            }
            if(windowIsOnActiveWorkspace) {
                owenWorkspace++;
            } else {
                otherWorkspace++;
            }
            if(owenWorkspace > 0 && otherWorkspace > 0) return;
        }

        this._appSwitcher._separator.destroy();
        this._appSwitcher._separator = null;
    };

    AltTab.AltTabPopup.prototype._removeGroupSeperator = function(group) {
        if(this._thumbnails == null || this._thumbnails._separator == null) return;

        let activeWorkspace = global.screen.get_active_workspace();
        let owenWorkspace = 0;
        let otherWorkspace = 0;

        for(let i = 0; i < group['cachedWindows'].length; i++) {
            if(group['cachedWindows'][i].get_workspace() == activeWorkspace) {
                owenWorkspace++;
            } else {
                otherWorkspace++;
            }
            if(owenWorkspace > 0 && otherWorkspace > 0) return;
        }

        this._thumbnails._separator.destroy();
        this._thumbnails._separator = null;
    };

    AltTab.AltTabPopup.prototype._closeWindow = function() {
        //close window
        let metaWindow = this._appIcons[this._currentApp]['cachedWindows'][0];
        if(this._currentWindow > 0) {
            metaWindow = this._appIcons[this._currentApp]['cachedWindows'][this._currentWindow];
        }
        metaWindow.delete(global.get_current_time());

        //are there any apps left?
        if(this._appIcons.length <= 1 && this._appIcons[this._currentApp]['cachedWindows'].length <= 1) {
            this.destroy();
            return true;
        }

        //remove app/thumbnail from cache
        if(this._appIcons[this._currentApp]['cachedWindows'].length > 1) {
            this._currentWindow = (this._currentWindow == -1 ? 0 : this._currentWindow);
            this._thumbnails._highlighted = (this._thumbnails._highlighted == -1 ? 0 : this._thumbnails._highlighted);

            this._appIcons[this._currentApp]['cachedWindows'].splice(this._currentWindow, 1);
            this._thumbnails._items[this._thumbnails._highlighted].destroy();
            this._thumbnails._items.splice(this._thumbnails._highlighted, 1);
        } else {
            this._appIcons.splice(this._currentApp, 1);
            this._appSwitcher._items[this._appSwitcher._highlighted].destroy();
            this._appSwitcher._items.splice(this._appSwitcher._highlighted, 1);
        }

        //remove app seperator?
        this._removeAppSeperator(this._appIcons);
        //remove group seperator?
        this._removeGroupSeperator(this._appIcons[this._currentApp]);

        //update indices
        if(this._currentApp >= this._appIcons.length) {
            this._currentApp = this._appIcons.length-1;
            this._appSwitcher._highlighted = -1;
            this._appSwitcher._curApp = this._appIcons.length-1;
        } else if(this._currentWindow >= this._appIcons[this._currentApp]['cachedWindows'].length) {
            this._currentWindow = this._appIcons[this._currentApp]['cachedWindows'].length-1;
            this._thumbnails._highlighted = -1;
        }

        //selecet next app
        if(this._appIcons[this._currentApp]['cachedWindows'].length <= 1) {
            this._select(this._currentApp, null, true);
            this._currentWindow = -1;
        } else {
            this._select(this._currentApp, this._currentWindow);
        }
        return true;
    };

    AltTab.AltTabPopup.prototype._moveWindow = function(moveTo) {
        let metaWindow = this._appIcons[this._currentApp]['cachedWindows'][0];
        if(this._currentWindow > 0) {
            metaWindow = this._appIcons[this._currentApp]['cachedWindows'][this._currentWindow];
        }

        //is the app on the target workspace?
        if(metaWindow.get_workspace().index() == moveTo-1) {
            return true;
        }

        //add workspaces if there are not enough
        for(let i = Main._workspaces.length; i <= moveTo; i++) {
            global.screen.append_new_workspace(false, global.get_current_time());
        }

        //move window to desired workspace
        metaWindow.change_workspace_by_index(moveTo-1, false, global.get_current_time());

        //update AppSwitcher
        this._updateAppSwitcher();
        return true;
    };

    AltTab.AltTabPopup.prototype._updateAppSwitcher = function() {
        //get all running apps
        let tracker = Shell.WindowTracker.get_default();
        let apps = tracker.get_running_apps('');

        //remove all entries and the appSwitcher actor
        this._appSwitcher.actor.destroy();
        this._appSwitcher = null;

        //create new appSwitcher list
        this._appSwitcher = new AltTab.AppSwitcher(apps, this);
        this.actor.add_actor(this._appSwitcher.actor);
        this._appSwitcher.connect('item-activated', Lang.bind(this, this._appActivated));
        this._appSwitcher.connect('item-entered', Lang.bind(this, this._appEntered));
        this._appIcons = [];
        this._appIcons = this._appSwitcher.icons;

        // Need to force an allocation so we can figure out whether we
        // need to scroll when selecting
        this.actor.get_allocation_box();

        //update thumbnails if there are any
        if(this._thumbnails != null) {
            this._thumbnails.actor.destroy();
            this._thumbnails = null;
            this._createThumbnails();
            this._thumbnails.actor.opacity = 255;
        }

        //select window
        if(this._currentWindow != -1) {
            this._select(this._currentApp, this._currentWindow);
        } else {
            this._select(this._currentApp);
        }
    };

    AltTab.AltTabPopup.prototype._keyPressEventFunction = AltTab.AltTabPopup.prototype._keyPressEvent;
    AltTab.AltTabPopup.prototype._keyPressEvent = function(actor, event) {
        if(!global.display) {
            global.display = global.screen.get_display();
        }

        let keysym = event.get_key_symbol();
        if(keysym == Clutter.KEY_w || keysym == Clutter.KEY_W) {
            return this._closeWindow();
        } else if(keysym == Clutter.KEY_1) {
            return this._moveWindow(1);
        } else if(keysym == Clutter.KEY_2) {
            return this._moveWindow(2);
        } else if(keysym == Clutter.KEY_3) {
            return this._moveWindow(3);
        } else if(keysym == Clutter.KEY_4) {
            return this._moveWindow(4);
        } else if(keysym == Clutter.KEY_5) {
            return this._moveWindow(5);
        } else if(keysym == Clutter.KEY_6) {
            return this._moveWindow(6);
        } else if(keysym == Clutter.KEY_7) {
            return this._moveWindow(7);
        } else if(keysym == Clutter.KEY_8) {
            return this._moveWindow(8);
        } else if(keysym == Clutter.KEY_9) {
            return this._moveWindow(9);
        } else if(keysym == Clutter.KEY_0) {
            return this._moveWindow(10);
        }

        this._keyPressEventFunction(actor, event);
    };
}
