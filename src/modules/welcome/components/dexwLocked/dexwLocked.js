(() => {
    'use strict';

    const ds = require('data-service');

    class DexwLockedCtrl {

        static $inject = [
            '$scope',
            '$state',
            'user',
            'exportStorageService',
            'storage'
        ];

        /**
         * @type {boolean}
         */
        isDesktop = false;
        /**
         * @type {'new' | 'old' | 'multiAccount'}
         */
        userType = 'new';
        /**
         * @type {string}
         */
        wavesExchangeLink = WavesApp.network.wavesExchangeLink;
        /**
         * @type {number}
         */
        step = 0;

        constructor($scope, $state, user, exportStorageService, storage) {
            this.$scope = $scope;
            this.$state = $state;
            this.user = user;
            this.exportStorageService = exportStorageService;
            this.storage = storage;
        }

        $onInit() {
            this.isDesktop = WavesApp.isDesktop();
            Promise.all([
                this.user.getMultiAccountUsersCount(),
                this.user.getFilteredUserList()
            ]).then(([multiAccountCount, userList]) => {
                if (userList && userList.length && multiAccountCount === 0) {
                    this.userType = 'old';
                } else if (multiAccountCount) {
                    this.userType = 'multiAccount';
                } else {
                    this.userType = 'new';
                }
                this.$scope.$apply();
            });
        }

        onSign() {
            this.moving();
        }

        moving() {
            analytics.send({
                name: 'Start migration',
                target: 'all'
            });

            if (this.isDesktop) {
                this.$state.go('desktopUpdate');
            } else {
                this._export();
            }
        }

        _export() {
            const connectProvider = this._getConnectProvider();

            this.step = this.step + 1;

            this.exportStorageService.export({
                provider: connectProvider,
                attempts: 20,
                timeout: 2000
            });

            this.exportStorageService.onData().then(result => {
                if (result.payload === 'ok') {
                    this.step = this.step + 1;
                    this.$scope.$apply();

                    analytics.send({
                        name: 'End migration',
                        target: 'all'
                    });

                    return this.storage.save('migrationSuccess', true);
                } else {
                    analytics.send({
                        name: 'Bad migration',
                        target: 'all'
                    });

                    this.step = this.step - 1;
                    this.$scope.$apply();

                    return this.storage.save('migrationSuccess', false);
                }
            });
        }

        /**
         * @returns {ConnectProvider}
         */
        _getConnectProvider() {
            const origins = WavesApp.isProduction() ?
                WavesApp.network.migration.origins :
                '*';

            const childWindow = window.open(WavesApp.network.migration.webUrl);

            return new ds.connect.PostMessageConnectProvider({
                win: childWindow,
                mode: 'export',
                origins
            });
        }

    }

    angular.module('app.welcome').component('wDexwLocked', {
        templateUrl: 'modules/welcome/components/dexwLocked/dexwLocked.html',
        controller: DexwLockedCtrl
    });
})();