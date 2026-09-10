import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import create_app
from app.settings import Settings
from app.settings.storage import config_directory, load_settings, save_settings
from app.domain.migrations import migrate_project

class SettingsAndFilesTests(unittest.TestCase):
    def test_platform_paths_and_atomic_config(self):
        self.assertEqual(str(config_directory('darwin', {}, '/users/test')), '/users/test/Library/Application Support/biaoshu2')
        self.assertEqual(str(config_directory('linux', {'XDG_CONFIG_HOME':'relative'}, '/users/test')), '/users/test/.config/biaoshu2')
        self.assertEqual(str(config_directory('linux', {'XDG_CONFIG_HOME':'/config'}, '/users/test')), '/config/biaoshu2')
        self.assertEqual(str(config_directory('win32', {'APPDATA':'/roaming'}, '/users/test')), '/roaming/biaoshu2')
        with tempfile.TemporaryDirectory() as directory:
            settings = Settings(provider='openai', api_key='synthetic-only', model='test')
            save_settings(settings, directory)
            self.assertEqual(load_settings(directory), settings)
            with patch('app.settings.storage.os.replace', side_effect=OSError('disk full')):
                with self.assertRaises(OSError):
                    save_settings(Settings(), directory)
            self.assertEqual(load_settings(directory), settings)
            self.assertEqual(len(list(Path(directory).iterdir())), 1)

    def test_settings_api_masks_key_and_rejects_external_origin(self):
        with tempfile.TemporaryDirectory() as directory:
            with TestClient(create_app(Settings(), config_directory=directory, log_directory=Path(directory)/'logs')) as client:
                response=client.put('/api/v1/settings', json={'base_url':'https://example.com/v1','model':'test','api_key':'synthetic-only'})
                self.assertEqual(response.status_code, 200)
                self.assertNotIn('synthetic-only', response.text)
                self.assertNotIn('synthetic-only', client.get('/api/v1/settings').text)
                response=client.put('/api/v1/settings', json={'base_url':'https://example.com/v1','model':'second','api_key':''})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(load_settings(directory).api_key, 'synthetic-only')
                self.assertEqual(client.get('/api/v1/health').json()['provider'], 'openai')
                self.assertEqual(client.put('/api/v1/settings', headers={'origin':'https://external.example'}, json={}).status_code,403)
                self.assertEqual(client.get('/api/v1/health', headers={'host':'evil.example'}).status_code,403)

    def test_explicit_migration_and_future_rejection(self):
        value=json.loads((Path(__file__).parents[2]/'packages/contracts/examples/flowchart-project.json').read_text())
        value['project_file_version']='0.9';value.pop('metadata')
        project,migrated=migrate_project(value)
        self.assertTrue(migrated);self.assertEqual(project.project_file_version,'1.0');self.assertEqual(value['project_file_version'],'0.9')
        self.assertEqual(project.versions[0].layout.model_dump(mode='json'),value['versions'][0]['layout'])
        value['unknown_core']=True
        with self.assertRaises(ValueError):migrate_project(value)
        value['project_file_version']='2.0'
        with self.assertRaisesRegex(ValueError,'2.0'):migrate_project(value)
