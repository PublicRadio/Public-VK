# [VK.com](https://vk.com) Public API
*non-official implementation of VK.com OAuth 2 and API call engine with performance optimisations*

## Usage

```
import {VK} from 'public-vk-api'

const application_id = 123456
const permissions = 6
const vk = new VK(application_id)
vk.call('wall.get', {owner_id: 1}).then(console.log.bind(console))

document.querySelector('#auth').onClick(() => vk.login(permissions))
vk.logout()
```

And... that's all
